#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const UNIT = 100_000_000n;
const SUPPLY = 2_000n;
const MARKET_CELL_CAPACITY = 300n;
const MARKET_MARKER_CAPACITY = 300n;
const CUSTODY_CAPACITY = 350n;
const CUSTODY_MARKER_CAPACITY = 350n;
const PLAIN_CELL_CAPACITY = 61n;
const XUDT_CELL_CAPACITY = 142n;
const FEE_SHANNONS = 1_000_000n;

const scenarios = [
  { name: 'low-capital', base: 10_000_000n, step: 10_000n },
  { name: 'moderate-creator', base: 100_000_000n, step: 100_000n },
  { name: 'high-demand', base: 500_000_000n, step: 1_000_000n },
  { name: 'existing-synthetic-fixture', base: 1_000_000_000n, step: UNIT },
];

function ckb(shannons) {
  const whole = shannons / UNIT;
  const fraction = (shannons % UNIT).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function buyCost(sold, quantity, base, step) {
  return base * quantity + step * (quantity * sold + quantity * (quantity - 1n) / 2n);
}

function sellPayout(sold, quantity, base, step) {
  if (quantity > sold) throw new RangeError('cannot sell more than the sold supply');
  return buyCost(sold - quantity, quantity, base, step);
}

function scenarioResult({ name, base, step }) {
  const fullReserve = buyCost(0n, SUPPLY, base, step);
  const reserveAtMeasuredScale = buyCost(0n, 1_032n, base, step);
  const laterLotCost = buyCost(1_500n, 100n, base, step);
  const laterLotPayout = sellPayout(1_900n, 100n, base, step);
  return {
    name,
    curve: {
      supply: SUPPLY.toString(),
      base_price_shannons_per_unit: base.toString(),
      curve_step_shannons_per_unit: step.toString(),
      first_unit_price_ckb: ckb(base),
      last_unit_price_ckb: ckb(base + step * (SUPPLY - 1n)),
    },
    "100_unit_lot": {
      buy_at_launch_ckb: ckb(buyCost(0n, 100n, base, step)),
      buy_starting_after_1500_units_sold_ckb: ckb(laterLotCost),
      sell_payout_when_1900_units_are_sold_ckb: ckb(laterLotPayout),
    },
    reserve: {
      curve_reserve_at_1032_units_sold_ckb: ckb(reserveAtMeasuredScale),
      curve_reserve_at_full_sellout_ckb: ckb(fullReserve),
      market_cell_capacity_at_full_sellout_ckb: ckb(MARKET_CELL_CAPACITY * UNIT + fullReserve),
      fixed_protocol_singleton_capacity_ckb: (
        MARKET_CELL_CAPACITY + MARKET_MARKER_CAPACITY + CUSTODY_CAPACITY + CUSTODY_MARKER_CAPACITY
      ).toString(),
      total_fixed_plus_curve_capacity_at_full_sellout_ckb: ckb(
        (MARKET_CELL_CAPACITY + MARKET_MARKER_CAPACITY + CUSTODY_CAPACITY + CUSTODY_MARKER_CAPACITY) * UNIT + fullReserve,
      ),
      curve_reserve_is_creator_withdrawable: false,
    },
    participant_funding: {
      minimum_plain_change_cell_ckb: PLAIN_CELL_CAPACITY.toString(),
      measured_transaction_fee_ckb: ckb(FEE_SHANNONS),
      minimum_input_for_100_unit_later_buy_including_plain_change_and_fee_ckb: ckb(
        laterLotCost + PLAIN_CELL_CAPACITY * UNIT + FEE_SHANNONS,
      ),
      external_xudt_output_occupied_capacity_ckb: XUDT_CELL_CAPACITY.toString(),
      external_withdrawal_fee_input_including_xudt_output_plain_change_and_fee_ckb: ckb(
        (XUDT_CELL_CAPACITY + PLAIN_CELL_CAPACITY) * UNIT + FEE_SHANNONS,
      ),
    },
  };
}

const protectionBase = UNIT;
const protectionStep = 99n * UNIT;
const protectionReserve = buyCost(0n, 2n, protectionBase, protectionStep);
const firstBuyerExit = sellPayout(2n, 1n, protectionBase, protectionStep);
const remainingReserve = protectionReserve - firstBuyerExit;
const laterBuyerFloor = 80n * UNIT;

const result = {
  format: 'trade-v2-gate2-economic-stress-v1',
  classification: 'DERIVED_INTEGER_ARITHMETIC_PLUS_MEASURED_GATE2_BASELINE',
  formula: 'reserve(N) = N*base + step*N*(N-1)/2; buy(sold,q) = q*base + step*(q*sold + q*(q-1)/2)',
  assumptions: {
    supply_units: SUPPLY.toString(),
    shannons_per_ckb: UNIT.toString(),
    initial_market_inventory_cell_ckb: MARKET_CELL_CAPACITY.toString(),
    market_marker_cell_ckb: MARKET_MARKER_CAPACITY.toString(),
    custody_cell_ckb: CUSTODY_CAPACITY.toString(),
    custody_marker_cell_ckb: CUSTODY_MARKER_CAPACITY.toString(),
    capacities_are_locked_not_spendable_reserve: true,
    native_scenario_transactions_run: false,
  },
  scenarios: scenarios.map(scenarioResult),
  measured_scale_run: {
    evidence: 'evidence/native-1794410154147/',
    owners: 1_024,
    transactions: 73,
    owner_batches: 64,
    batch_owner_updates: 1_022,
    total_fees_shannons: '73000000',
    max_batch_cycles: '38476490',
    max_batch_transaction_bytes: 12_481,
    max_compiled_proof_bytes: 4_715,
    max_tms_witness_payload_bytes: 6_263,
    max_transaction_bytes: 111_749,
    synthetic_curve_reserve_at_1032_units_sold_ckb: '542316',
    synthetic_market_cell_capacity_at_1032_units_sold_ckb: '542616',
  },
  protection_counterexample: {
    classification: 'DERIVED_SOLVENCY_COUNTEREXAMPLE',
    supply_units: '2',
    base_price_ckb: '1',
    curve_step_ckb: '99',
    first_buyer_cost_ckb: '1',
    second_buyer_cost_ckb: '100',
    reserve_after_both_buys_ckb: ckb(protectionReserve),
    first_buyer_exit_payout_ckb: ckb(firstBuyerExit),
    reserve_remaining_for_second_buyer_ckb: ckb(remainingReserve),
    second_buyer_80_percent_floor_ckb: ckb(laterBuyerFloor),
    second_buyer_shortfall_ckb: ckb(laterBuyerFloor - remainingReserve),
    conclusion: 'The reversible curve does not provide an individual 80% purchase-price floor under simultaneous exit obligations.',
  },
};

const output = `${JSON.stringify(result, null, 2)}\n`;
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const outPath = path.resolve(process.argv[outIndex + 1]);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
} else {
  process.stdout.write(output);
}
