import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";

export const ONE_BI = BigInt.fromString('10');
export const TEN_BI = BigInt.fromString('10');

export function isNullBnbValue(value: string): boolean {
    return value == "0x0000000000000000000000000000000000000000000000000000000000000001";
}

export function powBigInt(n: BigInt, exp: BigInt): BigInt {
    for (let i = ONE_BI; i.lt(exp); i = i.plus(ONE_BI)) {
        n = n.times(TEN_BI);
    }

    return n;
}

export function tokenAmountToBigDecimal(amount: BigInt, decimals: BigInt): BigDecimal {
    return amount.toBigDecimal().div(powBigInt(TEN_BI, decimals).toBigDecimal());
}