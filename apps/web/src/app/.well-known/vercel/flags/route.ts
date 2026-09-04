import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import * as flags from "@/lib/flags/definitions";

export const GET = createFlagsDiscoveryEndpoint(() => getProviderData(flags));
