/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, log } from "@graphprotocol/graph-ts";
import {
  Pair,
  Token,
  NomiswapFactory,
  Transaction,
  Swap as SwapEvent,
} from "../generated/schema";
import { Mint, Burn, Swap, Transfer, Sync } from "../generated/templates/Pair/Pair";
import { updateNomiswapDayData, updatePairDayData, updatePairHourData, updateTokenDayData } from "./dayUpdates";
import { deriveUSDPrice, getTrackedVolumeUSD } from "./pricing";
import { convertTokenToDecimal, ADDRESS_ZERO, FACTORY_ADDRESS, ONE_BI, ZERO_BD, BI_18 } from "./utils";


export function handleSync(event: Sync): void {
  let pair = Pair.load(event.address.toHex());
  if(!pair) {
    log.debug("sync event, but pair doesn't exist: {}", [event.address.toHex()])
    return
  }

  let token0 = Token.load(pair.token0);
  if (!token0) {
    log.debug("sync event, but token0 doesn't exist: {}", [pair.token0])
    return
  }

  let token1 = Token.load(pair.token1);
  if (!token1) {
    log.debug("sync event, but token1 doesn't exist: {}", [pair.token1])
    return
  }

  let factory = NomiswapFactory.load(FACTORY_ADDRESS);

  if (!factory) {
    log.debug("sync event, but factory doesn't exist: {}", [FACTORY_ADDRESS])
    return
  }

  const previousReserve0 = pair.reserve0;
  const previousReserve1 = pair.reserve1;

  // reset token total liquidity amounts
  // if this is the first SYNC event for this pair
  // then both reserves are 0 and this operation doesnt have an effect
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1);

  // TODO: make constant
  // а что если сначала у нас была reserve0LiquidityUSD, а после текущей обработки евента - исчезнет (в условии снизу)
  // - это че, у нас останется висет старая reserve0LiquidityUSD?
  // проверяем что у пары определены цены токенов юсд
  // если они не определены - отнимать предыдущую trackedTotalLiquidity нет смысла - ведь ее и не было раньше 
  if (pair.reserve0LiquidityUSD.gt(ZERO_BD) && pair.reserve1LiquidityUSD.gt(ZERO_BD)) {
    token0.trackedTotalLiquidity = token0.trackedTotalLiquidity.minus(pair.reserve0)
    token0.trackedTotalLiquidityUSD = token0.trackedTotalLiquidityUSD.minus(pair.reserve0LiquidityUSD)

    token1.trackedTotalLiquidity = token1.trackedTotalLiquidity.minus(pair.reserve1)
    token1.trackedTotalLiquidityUSD = token1.trackedTotalLiquidityUSD.minus(pair.reserve1LiquidityUSD)
  }


  // updating pair reserves
  const reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals);
  const reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals);

  pair.reserve0 = reserve0;
  pair.reserve1 = reserve1;

  token0.totalLiquidity = token0.totalLiquidity.plus(reserve0);
  token1.totalLiquidity = token1.totalLiquidity.plus(reserve1);


  // if (pair.id == "0x8e50d726e2ea87a27fa94760d4e65d58c3ad8b44") {
  //   log.warning("[sync] usdt-busd reserve0={} reserve1={} raw_reserve0={} raw_reserve1={} token0.decimals={} token1.decimals={}", [
  //     reserve0.toString(),
  //     reserve1.toString(),
  //     event.params.reserve0.toString(),
  //     event.params.reserve1.toString(),
  //     token0.decimals.toString(),
  //     token1.decimals.toString(),
  //   ])
  // }

  const deriveResponse = deriveUSDPrice(reserve0, reserve1, token0, token1)
  const token0UsdPrice = deriveResponse.token0PriceUsd; 
  const token1UsdPrice = deriveResponse.token1PriceUsd;

  // if (pair.id == "0x8e50d726e2ea87a27fa94760d4e65d58c3ad8b44") {
  //   log.warning("[sync] usdt-busd raw_reserve0={} raw_reserve1={} token0.decimals={} token1.decimals={}", [
  //     event.params.reserve0.toString(),
  //     event.params.reserve1.toString(),
  //     token0.decimals.toString(),
  //     token1.decimals.toString(),
  //   ])
  // }

  if (token0UsdPrice.gt(ZERO_BD) && token1UsdPrice.gt(ZERO_BD)) {
    log.info(
      "Pair new usd prices: pair={} token0UsdPrice={} token1UsdPrice={}", 
      [pair.id, token0UsdPrice.toString(),  token1UsdPrice.toString()]      
    )

    pair.reserve0LiquidityUSD = pair.reserve0.times(token0UsdPrice)
    pair.reserve1LiquidityUSD = pair.reserve1.times(token1UsdPrice)

    token0.trackedTotalLiquidity = token0.trackedTotalLiquidity.plus(reserve0)
    token1.trackedTotalLiquidity = token1.trackedTotalLiquidity.plus(reserve1)

    log.info(
      "pair={} token0.trackedTotalLiquidity={}", 
      [pair.id, token0.trackedTotalLiquidity.toString()+" +"+reserve0.toString()]      
    )
    log.info(
      "pair={} token1.trackedTotalLiquidity={}", 
      [pair.id, token1.trackedTotalLiquidity.toString()+" +"+reserve1.toString()]      
    )

    token0.trackedTotalLiquidityUSD = token0.trackedTotalLiquidityUSD.plus(pair.reserve0LiquidityUSD)
    token1.trackedTotalLiquidityUSD = token1.trackedTotalLiquidityUSD.plus(pair.reserve1LiquidityUSD)
    token0.derivedUSD = token0UsdPrice;
    token1.derivedUSD = token1UsdPrice;
  } else {
    log.debug("Pair zero liqudity pair={} token0UsdPrice={} token1UsdPrice={}", [
      pair.id,
      token0UsdPrice.toString(),
      token1UsdPrice.toString()
    ])
    pair.reserve0LiquidityUSD = ZERO_BD
    pair.reserve1LiquidityUSD = ZERO_BD
    // no need to subtract liqudity from tokens, as we subtracted it at the earlier step (if it was no 0)
  }

  // TODO: price dilation

  token0.save()
  token1.save()
  pair.save()
}


export function handleSwap(event: Swap): void {
  const pair = Pair.load(event.address.toHex())
  if(!pair) {
    log.debug("swap event, but pair doesn't exist: {}", [event.address.toHex()])
    return
  }

  let token0 = Token.load(pair.token0);
  if (!token0) {
    log.debug("swap event, but token0 doesn't exist: {}", [pair.token0])
    return
  }

  let token1 = Token.load(pair.token1);
  if (!token1) {
    log.debug("swap event, but token1 doesn't exist: {}", [pair.token1])
    return
  }

  const amount0In  = convertTokenToDecimal(event.params.amount0In, token0.decimals);
  const amount1In  = convertTokenToDecimal(event.params.amount1In, token1.decimals);
  const amount0Out = convertTokenToDecimal(event.params.amount0Out, token0.decimals);
  const amount1Out = convertTokenToDecimal(event.params.amount1Out, token1.decimals);

  // totals for volume updates
  let amount0Total = amount0Out.plus(amount0In);
  let amount1Total = amount1Out.plus(amount1In);

  let trackedAmountUSD = getTrackedVolumeUSD(
    amount0Total,
    token0,
    amount1Total,
    token1,
  );

    // update token0 global volume and token liquidity stats
  token0.tradeVolume = token0.tradeVolume.plus(amount0In.plus(amount0Out));
  token0.tradeVolumeUSD = token0.tradeVolumeUSD.plus(trackedAmountUSD);
  token0.totalTransactions = token0.totalTransactions.plus(ONE_BI);

  
  // update token1 global volume and token liquidity stats
  token1.tradeVolume = token1.tradeVolume.plus(amount1In.plus(amount1Out));
  token1.tradeVolumeUSD = token1.tradeVolumeUSD.plus(trackedAmountUSD);
  token1.totalTransactions = token1.totalTransactions.plus(ONE_BI);



  // update pair volume data, use tracked amount if we have it as its probably more accurate
  pair.volumeUSD = pair.volumeUSD.plus(trackedAmountUSD);
  pair.volumeToken0 = pair.volumeToken0.plus(amount0Total);
  pair.volumeToken1 = pair.volumeToken1.plus(amount1Total);
  pair.totalTransactions = pair.totalTransactions.plus(ONE_BI);
  pair.save();

  // update global values, only used tracked amounts for volume
  let nomiswap = NomiswapFactory.load(FACTORY_ADDRESS)!;
  nomiswap.totalVolumeUSD = nomiswap.totalVolumeUSD.plus(trackedAmountUSD);
  nomiswap.totalTransactions = nomiswap.totalTransactions.plus(ONE_BI);

  // save entities
  pair.save();
  token0.save();
  token1.save();
  nomiswap.save();

  let transaction = Transaction.load(event.transaction.hash.toHex());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHex());
    transaction.block = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.swaps = [];
  }
  let swaps = transaction.swaps;
  let swap = new SwapEvent(event.transaction.hash.toHex().concat("-").concat(BigInt.fromI32(swaps.length).toString()));

  // update swap event
  swap.transaction = transaction.id;
  swap.pair = pair.id;
  swap.timestamp = transaction.timestamp;
  swap.transaction = transaction.id;
  swap.sender = event.params.sender;
  swap.amount0In = amount0In;
  swap.amount1In = amount1In;
  swap.amount0Out = amount0Out;
  swap.amount1Out = amount1Out;
  swap.to = event.params.to;
  swap.from = event.transaction.from;
  swap.logIndex = event.logIndex;
  // use the tracked amount if we have it
  swap.amountUSD = trackedAmountUSD;
  swap.save();

  // update the transaction

  // TODO: Consider using .concat() for handling array updates to protect
  // against unintended side effects for other code paths.
  swaps.push(swap.id);
  transaction.swaps = swaps;
  transaction.save();

  // update day entities
  let pairDayData = updatePairDayData(event);
  let pairHourData = updatePairHourData(event);
  let nomiswapDayData = updateNomiswapDayData(event);
  let token0DayData = updateTokenDayData(token0, event);
  let token1DayData = updateTokenDayData(token1, event);

  // swap specific updating
  nomiswapDayData.dailyVolumeUSD = nomiswapDayData.dailyVolumeUSD.plus(trackedAmountUSD);
  nomiswapDayData.save();

  // swap specific updating for pair
  pairDayData.dailyVolumeToken0 = pairDayData.dailyVolumeToken0.plus(amount0Total);
  pairDayData.dailyVolumeToken1 = pairDayData.dailyVolumeToken1.plus(amount1Total);
  pairDayData.dailyVolumeUSD = pairDayData.dailyVolumeUSD.plus(trackedAmountUSD);
  pairDayData.save();
 
  // update hourly pair data
  pairHourData.hourlyVolumeToken0 = pairHourData.hourlyVolumeToken0.plus(amount0Total);
  pairHourData.hourlyVolumeToken1 = pairHourData.hourlyVolumeToken1.plus(amount1Total);
  pairHourData.hourlyVolumeUSD = pairHourData.hourlyVolumeUSD.plus(trackedAmountUSD);
  pairHourData.save();

  // swap specific updating for token0
  token0DayData.dailyVolumeToken = token0DayData.dailyVolumeToken.plus(amount0Total);
  token0DayData.dailyVolumeUSD = token0DayData.dailyVolumeUSD.plus(
    amount0Total.times(token0.derivedUSD)
  );
  token0DayData.save();

  // swap specific updating
  token1DayData.dailyVolumeToken = token1DayData.dailyVolumeToken.plus(amount1Total);
  token1DayData.dailyVolumeUSD = token1DayData.dailyVolumeUSD.plus(
    amount1Total.times(token1.derivedUSD)
  );
  token1DayData.save();
}