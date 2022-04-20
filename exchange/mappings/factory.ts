/* eslint-disable prefer-const */
import { NomiswapFactory, Pair, Token, } from "../generated/schema";
import { Pair as PairTemplate } from "../generated/templates";
import { PairCreated } from "../generated/Factory/Factory";
import {
  FACTORY_ADDRESS,
  ZERO_BD,
  ZERO_BI,
  ONE_BI,
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenDecimals,
} from "./utils";

export function handlePairCreated(event: PairCreated): void {
  let factory = NomiswapFactory.load(FACTORY_ADDRESS);
  if (factory === null) {
    factory = new NomiswapFactory(FACTORY_ADDRESS);
    factory.totalPairs = ZERO_BI;
    factory.totalTransactions = ZERO_BI;
    factory.totalLiquidityBNB = ZERO_BD;
    factory.totalVolumeUSD = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalLiquidityUSD = ZERO_BD;
  }
  
  factory.totalPairs = factory.totalPairs.plus(ONE_BI);
  factory.save();

  let token0 = Token.load(event.params.token0.toHex());
  if (token0 === null) {
    token0 = new Token(event.params.token0.toHex());
    token0.name = fetchTokenName(event.params.token0);
    token0.symbol = fetchTokenSymbol(event.params.token0);
    let decimals = fetchTokenDecimals(event.params.token0);
    if (decimals === null) {
      return;
    }
    token0.decimals = decimals;
    token0.save();
  }

  let token1 = Token.load(event.params.token1.toHex());
  if (token1 === null) {
    token1 = new Token(event.params.token1.toHex());
    token1.name = fetchTokenName(event.params.token1);
    token1.symbol = fetchTokenSymbol(event.params.token1);
    let decimals = fetchTokenDecimals(event.params.token1);
    if (decimals === null) {
      return;
    }
    token1.decimals = decimals;
    token1.save();
  }

  let pair = new Pair(event.params.pair.toHex()) as Pair;
  pair.token0 = token0.id;
  pair.token1 = token1.id;
  pair.name = token0.symbol.concat("-").concat(token1.symbol);
  pair.totalTransactions = ZERO_BI;
  pair.reserve0 = ZERO_BD;
  pair.reserve1 = ZERO_BD;
  pair.block = event.block.number;
  pair.timestamp = event.block.timestamp;
  pair.save();

  PairTemplate.create(event.params.pair);
}
