import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ERC20 } from "../generated/Factory/ERC20";
import { ERC20NameBytes } from "../generated/Factory/ERC20NameBytes";
import { ERC20SymbolBytes } from "../generated/Factory/ERC20SymbolBytes";
import { isNullBnbValue } from "./common";


export function fetchTokenSymbol(tokenAddress: Address): string {
    const tokenContract = ERC20.bind(tokenAddress);
    const resultSymbol = tokenContract.try_symbol();
    if (!resultSymbol.reverted) {
        return resultSymbol.value;
    }

    const tokenContractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress);
    const resultSymbolBytes = tokenContractSymbolBytes.try_symbol();
    if (!resultSymbolBytes.reverted && !isNullBnbValue(resultSymbolBytes.value.toHex())) {
        return resultSymbolBytes.value.toString();
    }

    return "unknown";
}

export function fetchTokenName(tokenAddress: Address): string {
    const tokenContract = ERC20.bind(tokenAddress);
    const resultName = tokenContract.try_name();
    if (!resultName.reverted) {
        return resultName.value;
    }

    const tokenContractNameBytes = ERC20NameBytes.bind(tokenAddress);
    const resultNameBytes = tokenContractNameBytes.try_name();
    if (!resultNameBytes.reverted && !isNullBnbValue(resultNameBytes.value.toHex())) {
        return resultNameBytes.value.toString();
    }

    return "unknown";
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
    const tokenContract = ERC20.bind(tokenAddress);
    const resultDecimals = tokenContract.try_decimals();
    const decimals = !resultDecimals.reverted ? resultDecimals.value : 0;

    return BigInt.fromI32(decimals as i32);
}