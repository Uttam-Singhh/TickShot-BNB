#!/bin/bash
set -a
source .env
set +a

CONTRACT=0x70474c100F6B82e8Def7Fa2797863b9af62C9467
RPC=$BSC_TESTNET_RPC
PK=$PRIVATE_KEY

# Strip cast's scientific notation suffix e.g. "1771403509 [1.771e9]" -> "1771403509"
strip_cast() {
    echo "$1" | sed 's/ *\[.*\]//' | tr -d ' '
}

# Fetch live BNB/USD price from Binance and convert to 8-decimal int (Chainlink format)
get_binance_price() {
    local raw_price
    raw_price=$(curl -s "https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT" | grep -o '"price":"[^"]*"' | grep -o '[0-9.]*')
    if [ -z "$raw_price" ]; then
        echo ""
        return 1
    fi
    # Convert to 8-decimal integer: multiply by 10^8
    # Use awk for floating point math
    local int_price
    int_price=$(echo "$raw_price" | awk '{printf "%.0f", $1 * 100000000}')
    echo "$int_price"
}

echo "=== TickShot Round Runner (Binance Price Feed) ==="
echo "Contract: $CONTRACT"
echo ""

while true; do
    ROUND_ID=$(strip_cast "$(cast call $CONTRACT 'currentRoundId()(uint256)' --rpc-url $RPC 2>/dev/null)")
    echo "[$(date +%H:%M:%S)] Current round: $ROUND_ID"

    if [ "$ROUND_ID" -gt 0 ] 2>/dev/null; then
        RAW=$(cast call $CONTRACT "getRound(uint256)(uint256,uint8,uint8,int256,int256,uint256,uint256,uint256,uint256,uint256)" $ROUND_ID --rpc-url $RPC 2>/dev/null)
        END_TIME=$(strip_cast "$(echo "$RAW" | sed -n '8p')")
        STATUS=$(strip_cast "$(echo "$RAW" | sed -n '2p')")
        NOW=$(date +%s)

        echo "[$(date +%H:%M:%S)] Status: $STATUS | End: $END_TIME | Now: $NOW"

        if [ "$STATUS" = "3" ]; then
            echo "[$(date +%H:%M:%S)] Round $ROUND_ID settled. Starting new round..."
            PRICE=$(get_binance_price)
            if [ -z "$PRICE" ]; then
                echo "[$(date +%H:%M:%S)] ERROR: Failed to fetch Binance price, retrying in 5s..."
                sleep 5
                continue
            fi
            echo "[$(date +%H:%M:%S)] Binance BNB/USD price: $PRICE (8 decimals)"
            cast send $CONTRACT "startRoundWithPrice(int256)" $PRICE --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
            echo "[$(date +%H:%M:%S)] New round started!"
            sleep 5
            continue
        fi

        if [ "$NOW" -ge "$END_TIME" ] && [ "$STATUS" != "3" ]; then
            echo "[$(date +%H:%M:%S)] Resolving round $ROUND_ID..."
            PRICE=$(get_binance_price)
            if [ -z "$PRICE" ]; then
                echo "[$(date +%H:%M:%S)] ERROR: Failed to fetch Binance price, retrying in 5s..."
                sleep 5
                continue
            fi
            echo "[$(date +%H:%M:%S)] Binance BNB/USD end price: $PRICE (8 decimals)"
            cast send $CONTRACT "resolveRoundWithPrice(uint256,int256)" $ROUND_ID $PRICE --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
            echo "[$(date +%H:%M:%S)] Round $ROUND_ID resolved!"
            sleep 3

            echo "[$(date +%H:%M:%S)] Starting new round..."
            PRICE=$(get_binance_price)
            if [ -z "$PRICE" ]; then
                echo "[$(date +%H:%M:%S)] ERROR: Failed to fetch Binance price, retrying in 5s..."
                sleep 5
                continue
            fi
            echo "[$(date +%H:%M:%S)] Binance BNB/USD start price: $PRICE (8 decimals)"
            cast send $CONTRACT "startRoundWithPrice(int256)" $PRICE --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
            echo "[$(date +%H:%M:%S)] New round started!"
            sleep 5
            continue
        fi

        WAIT=$((END_TIME - NOW + 2))
        echo "[$(date +%H:%M:%S)] Waiting ${WAIT}s for round to end..."
        sleep $WAIT
    else
        echo "[$(date +%H:%M:%S)] No rounds yet. Starting first round..."
        PRICE=$(get_binance_price)
        if [ -z "$PRICE" ]; then
            echo "[$(date +%H:%M:%S)] ERROR: Failed to fetch Binance price, retrying in 5s..."
            sleep 5
            continue
        fi
        echo "[$(date +%H:%M:%S)] Binance BNB/USD price: $PRICE (8 decimals)"
        cast send $CONTRACT "startRoundWithPrice(int256)" $PRICE --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
        echo "[$(date +%H:%M:%S)] Round started!"
        sleep 5
    fi
done
