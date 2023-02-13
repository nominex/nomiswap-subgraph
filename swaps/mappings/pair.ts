import { log } from "@graphprotocol/graph-ts";
import { Swap } from "../generated/templates/Pair/Pair";
import { Pair, Token, Swap as SwapEntity, Transaction } from "../generated/schema";
import { tokenAmountToBigDecimal } from "../utils/common";

export function handleSwap(event: Swap): void {
    let transaction = Transaction.load(event.transaction.hash.toHex());
    if (!transaction) {
        transaction = new Transaction(event.transaction.hash.toHex());
        transaction.block = event.block.number;
        transaction.timestamp = event.block.timestamp;
        transaction.gasPrice = event.transaction.gasPrice;
        transaction.gasLimit = event.transaction.gasLimit;
        if (event.receipt) {
            transaction.gasUsed = event.receipt!.gasUsed;
        }
        transaction.save();
    }

    const pair = Pair.load(event.address.toHex());
    if (!pair) {
        log.error('No pair {} to handle swap', [event.address.toHex()]);
        return;
    }

    const token0 = Token.load(pair.token0);
    if (!token0) {
        log.error('No token0 {} of pair {}', [pair.token0, pair.id]);
        return;
    }

    const token1 = Token.load(pair.token1);
    if (!token1) {
        log.error('No token1 {} of pair {}', [pair.token1, pair.id]);
        return;
    }

    log.debug('Handle swap event of pair {}', [event.address.toHex()]);
    const amount0In  = tokenAmountToBigDecimal(event.params.amount0In, token0.decimals);
    const amount1In  = tokenAmountToBigDecimal(event.params.amount1In, token1.decimals);
    const amount0Out = tokenAmountToBigDecimal(event.params.amount0Out, token0.decimals);
    const amount1Out = tokenAmountToBigDecimal(event.params.amount1Out, token1.decimals);

    const swapId = event.block.hash.toHex().concat('-').concat(event.logIndex.toString());
    const swap = new SwapEntity(swapId);
    swap.block = event.block.number;
    swap.logIndex = event.logIndex;
    swap.timestamp = event.block.timestamp;
    swap.transaction = transaction.id;
    swap.sender = event.transaction.from;
    swap.pair = pair.id;
    swap.amount0In = amount0In;
    swap.amount0Out = amount0Out;
    swap.amount1In = amount1In;
    swap.amount1Out = amount1Out;
    swap.order = event.block.number.leftShift(32).plus(event.logIndex);
    swap.save();
}