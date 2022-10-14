import {BigDecimal, BigInt} from "@graphprotocol/graph-ts";
import {BI_16, BI_2, BI_3, BI_4, ONE_BI, ZERO_BI} from "./utils";
import {Pair, Token} from "../generated/schema";

export class StablePairParams {

  static readonly A_PRECISION : BigInt = BigInt.fromI32(100);
  static readonly STORAGE: Map<string, StablePairParams> = new Map();

  static getOrInit(pair: Pair) : StablePairParams {
    let params: StablePairParams;
    if (StablePairParams.STORAGE.has(pair.id)) {
      params = StablePairParams.STORAGE.get(pair.id);
    } else {
      params = new StablePairParams(pair.timestamp);
      StablePairParams.STORAGE.set(pair.id, params);
    }

    return params;
  }

  public initialA: BigInt = BigInt.fromI32(2000).times(StablePairParams.A_PRECISION); // from contract initialization
  public initialATime: BigInt = ZERO_BI;
  public futureA: BigInt = this.initialA; // from contract initialization
  public futureATime: BigInt = ZERO_BI;

  public constructor(timestamp: BigInt) {
    this.futureATime = timestamp;
  }

  // from contract
  public getA(timestamp : BigInt) : BigInt {
    const A1 : BigInt = this.futureA;
    const t1 : BigInt = this.futureATime;

    if (timestamp.lt(t1)) {
      let A0 : BigInt = this.initialA;
      let t0 : BigInt = this.initialATime;
      // Expressions in uint32 cannot have negative numbers, thus "if"
      if (A1.gt(A0)) {
        return A0.plus(timestamp.minus(t0).times(A1.minus(A0)).div(t1.minus(t0)));
      } else {
        return A0.minus(timestamp.minus(t0).times(A0.minus(A1).div(t1.minus(t0))));
      }
    } else {
      // when t1 == 0 or timestamp >= t1
      return A1;
    }
  }

  public newPrice(token0: Token, token1: Token, reserve0: BigInt, reserve1: BigInt, timestamp: BigInt) : StablePairPrice {
    return new StablePairPrice(this, token0, token1, reserve0, reserve1, timestamp);
  }

}

export class StablePairPrice {

  public constructor(
    private readonly params: StablePairParams,
    private readonly token0: Token,
    private readonly token1: Token,
    private readonly reserve0: BigInt,
    private readonly reserve1: BigInt,
    private readonly timestamp: BigInt
  ) {}

  public get token0Price() : BigDecimal {
    const A = this.params.getA(this.timestamp);
    const D = this.getD(this.reserve0, this.reserve1);
    // numerator = 16Ax**2y**2+yD**3
    // denominator = 16Ax**2y**2+xD**3
    const AExpr = BI_16.times(A).times(this.reserve0.pow(2)).times(this.reserve1.pow(2));
    const DExp3 = D.pow(3);

    const numerator = AExpr.plus(this.reserve1.times(DExp3)).toBigDecimal();
    const denominator = AExpr.plus(this.reserve0.times(DExp3)).toBigDecimal();

    return numerator.div(denominator);
  }

  public get token1Price() : BigDecimal {
    const A = this.params.getA(this.timestamp);
    const D = this.getD(this.reserve1, this.reserve0);
    // numerator = 16Ax**2y**2+xD**3
    // denominator = 16Ax**2y**2+yD**3
    const AExpr = BI_16.times(A).times(this.reserve0.pow(2)).times(this.reserve1.pow(2));
    const DExp3 = D.pow(3);

    const numerator = AExpr.plus(this.reserve0.times(DExp3)).toBigDecimal();
    const denominator = AExpr.plus(this.reserve1.times(DExp3)).toBigDecimal();

    return numerator.div(denominator);
  }

  private getD(reserve0: BigInt, reserve1: BigInt) : BigInt {
    const S = this.reserve0.plus(this.reserve1);
    if (S.equals(ZERO_BI)) {
      return ZERO_BI;
    }

    const A = this.params.getA(this.timestamp);
    const A_PRECISION = StablePairParams.A_PRECISION;

    const N_A = A.times(BI_4);
    let DPrev = ZERO_BI;
    let D = S;

    for (let i: number = 0; i < 256; i += 1) {
      DPrev = D;

      const D_P = D.pow(2).div(reserve0).times(D).div(reserve1).div(BI_4);
      const numerator = N_A.times(S).div(A_PRECISION).plus(D_P.times(BI_2)).times(D);
      const denominator = N_A.times(D).div(A_PRECISION).minus(D).plus(D_P.times(BI_3));
      D = numerator.div(denominator);

      if (this.within1(D, DPrev)) {
        break;
      }
    }

    return D;
  }

  private within1(x: BigInt, y: BigInt): boolean {
    if (x.gt(y)) {
      return x.minus(y).le(ONE_BI);
    } else {
      return y.minus(x).le(ONE_BI);
    }
  }

}