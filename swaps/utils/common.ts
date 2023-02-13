import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ONE_BD = BigDecimal.fromString('1');
export const TEN_BD = BigDecimal.fromString('10');

export function isNullBnbValue(value: string): boolean {
    return value == "0x0000000000000000000000000000000000000000000000000000000000000001";
}

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
    let bd = ONE_BD;
    for (let i = ZERO_BI; i.lt(decimals); i = i.plus(ONE_BI)) {
        bd = bd.times(TEN_BD);
    }

    return bd;
}

export function tokenAmountToBigDecimal(tokenAmount: BigInt, decimals: BigInt): BigDecimal {
    if (decimals.equals(ZERO_BI)) {
        return tokenAmount.toBigDecimal();
    }

    return tokenAmount.toBigDecimal().div(exponentToBigDecimal(decimals));
}