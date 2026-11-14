import { SignersController, type SignersControllerRefreshContext } from "@ckb-ccc/connector-react";

class RovekoSignersController extends SignersController {
  override async refresh(...args: Parameters<SignersController["refresh"]>) {
    try {
      await super.refresh(...args);
    } catch (error) {
      console.warn("A wallet provider could not be discovered; remaining CCC wallet choices are available.", error);
      this.disconnect();
      const [client, onUpdate, configs] = args;
      const { appName, appIcon, preferredNetworks } = this.getConfig(configs);
      const context: SignersControllerRefreshContext = { client, appName, appIcon, preferredNetworks, onUpdate, wallets: [] };
      await this.addDummySigners(context);
    }
  }
}

export const rovekoSignersController = new RovekoSignersController();
