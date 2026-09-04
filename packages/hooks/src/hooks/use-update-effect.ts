import { useEffect } from "react";
import { createUpdateEffect } from "../create-update-effect";

/** Effect that skips the first run — runs only when deps change after mount. */
export const useUpdateEffect = createUpdateEffect(useEffect);
