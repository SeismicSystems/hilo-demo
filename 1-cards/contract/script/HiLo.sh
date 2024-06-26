RPC_URL=http://localhost:8545
DEV_PRIV_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

N_ROUNDS=2
START_CHIPS=10

forge create src/HiLoCards.sol:HiLoCards \
    --rpc-url $RPC_URL \
    --private-key $DEV_PRIV_KEY \
    --constructor-args $N_ROUNDS $START_CHIPS > game_deploy_out.txt
GAME_ADDR=$(awk '/Deployed to:/ {print $3}' game_deploy_out.txt)

echo "{ 
    \"gameAddress\": \"$GAME_ADDR\" 
}" > ./out/deployment.json
rm game_deploy_out.txt
