ROVEKO UI source attribution

The ROVEKO trader interface adapts the component hierarchy, layout proportions,
input treatment, market-list rows, portfolio sections, and chart presentation
from Raydium UI v3 Public.

Source: https://github.com/raydium-io/raydium-ui-v3-public
Pinned commit: 045a2a942711440b85e091ac313378a1e534f102
License: Apache License 2.0 (see LICENSE)

Adapted component references:
- src/features/Swap/Swap.tsx
- src/features/Swap/components/SwapPanel.tsx
- src/features/Swap/components/SwapInfoBoard.tsx
- src/features/Swap/components/SwapKlinePanel.tsx
- src/components/TokenInput.tsx
- src/features/Pools/components/PoolListItem.tsx
- src/features/Pools/components/PoolListHeader.tsx
- src/features/Portfolio/components/SectionOverview/
- src/features/Portfolio/components/SectionMyPositions/
- src/theme/

ROVEKO's implementation is a React 19 and Tailwind CSS v4 adaptation. It does
not include Raydium's Solana transaction logic or Chakra UI dependencies.
