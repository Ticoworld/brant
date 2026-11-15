"use client";

import { useEffect } from "react";
import { useCcc } from "@ckb-ccc/connector-react";
import { ccc } from "@ckb-ccc/core";
import { rovekoSignersController } from "./signers";

type ConnectorElement = HTMLElement & {
  client?: ccc.Client;
  signersController?: typeof rovekoSignersController;
};

export default function ConnectorClientBridge() {
  const { client } = useCcc();

  useEffect(() => {
    const connector = document.querySelector("ccc-connector") as ConnectorElement | null;
    if (!connector) return;

    connector.client = client;
    connector.signersController = rovekoSignersController;
  }, [client]);

  return null;
}
