#!/bin/bash
set -a
source .env
set +a

CONTRACT=0x3aa9A5AB43A30D0Fc811cf3A39DC71EC80c90b56
RPC=$BSC_TESTNET_RPC
PK=$PRIVATE_KEY

# Strip cast's scientific notation suffix e.g. "1771403509 [1.771e9]" -> "1771403509"
strip_cast() {
    echo "$1" | sed 's/ *\[.*\]//' | tr -d ' '
}

echo "=== TickShot Round Runner ==="
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
            cast send $CONTRACT "startRound()" --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
            echo "[$(date +%H:%M:%S)] New round started!"
            sleep 5
            continue
        fi

        if [ "$NOW" -ge "$END_TIME" ] && [ "$STATUS" != "3" ]; then
            echo "[$(date +%H:%M:%S)] Resolving round $ROUND_ID..."
            cast send $CONTRACT "resolveRound(uint256)" $ROUND_ID --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
            echo "[$(date +%H:%M:%S)] Round $ROUND_ID resolved!"
            sleep 3

            echo "[$(date +%H:%M:%S)] Starting new round..."
            cast send $CONTRACT "startRound()" --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
            echo "[$(date +%H:%M:%S)] New round started!"
            sleep 5
            continue
        fi

        WAIT=$((END_TIME - NOW + 2))
        echo "[$(date +%H:%M:%S)] Waiting ${WAIT}s for round to end..."
        sleep $WAIT
    else
        echo "[$(date +%H:%M:%S)] No rounds yet. Starting first round..."
        cast send $CONTRACT "startRound()" --private-key $PK --rpc-url $RPC --legacy 2>/dev/null
        echo "[$(date +%H:%M:%S)] Round started!"
        sleep 5
    fi
done
