import { PairCreated } from "../generated/Factory/Factory";
import { Factory, Pair, Token } from "../generated/schema";
import { Pair as PairTemplate } from "../generated/templates";
import { fetchTokenSymbol, fetchTokenName, fetchTokenDecimals } from "../utils/token";
import { Address, log } from "@graphprotocol/graph-ts";

export function handlePairCreated(event: PairCreated): void {
    log.debug('Handle pair created event of factory {}', [event.address.toHex()]);
    const factory = loadOrCreateFactory(event.address);
    const token0 = loadOrCreateToken(event.params.token0);
    const token1 = loadOrCreateToken(event.params.token1);

    const pair = new Pair(event.params.pair.toHex());
    pair.block = event.block.number;
    pair.timestamp = event.block.timestamp;
    pair.name = token0.symbol.concat("-").concat(token1.symbol);
    pair.factory = factory.id;
    pair.token0 = token0.id;
    pair.token1 = token1.id;
    pair.save();

    PairTemplate.create(event.params.pair);
}

function loadOrCreateFactory(address: Address): Factory {
    let factory = Factory.load(address.toHex());
    if (!factory) {
        factory = new Factory(address.toHex());
        factory.save();
    }

    return factory;
}

function loadOrCreateToken(address: Address): Token {
    let token = Token.load(address.toHex());
    if (!token) {
        token = new Token(address.toHex());
        token.name = fetchTokenName(address);
        token.symbol = fetchTokenSymbol(address);
        token.decimals = fetchTokenDecimals(address);
        token.save();
    }

    return token;
}