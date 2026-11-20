FROM rust:1.96.0-slim-bookworm AS native
WORKDIR /src/labs/trade-v2-token/gate2
COPY labs/trade-v2-token/gate2/ ./
ENV CARGO_TARGET_DIR=/native
RUN cargo build --release --locked --manifest-path browser-proof/Cargo.toml \
 && cargo build --release --locked --manifest-path smt-tools/Cargo.toml \
 && test -x /native/release/trade-v2-recovery \
 && test -x /native/release/trade-v2-smt-tools

FROM node:24.19.0-bookworm-slim AS build
WORKDIR /brant/apps/trade-testnet
COPY apps/trade-testnet/package*.json ./
RUN npm ci
COPY apps/trade-testnet/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:24.19.0-bookworm-slim
WORKDIR /brant/apps/trade-testnet
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    ROVEKO_PROOF_BINARY=/usr/local/bin/trade-v2-recovery \
    ROVEKO_SMT_BINARY=/usr/local/bin/trade-v2-smt-tools
COPY --from=native /native/release/trade-v2-recovery /native/release/trade-v2-smt-tools /usr/local/bin/
COPY --from=build /brant/apps/trade-testnet/package.json ./
COPY --from=build /brant/apps/trade-testnet/next.config.mjs ./
COPY --from=build /brant/apps/trade-testnet/node_modules ./node_modules
COPY --from=build /brant/apps/trade-testnet/.next ./.next
COPY --from=build /brant/apps/trade-testnet/public ./public
COPY --from=build /brant/apps/trade-testnet/lib/v2-engine/pudge-recover.cjs ./lib/v2-engine/
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
