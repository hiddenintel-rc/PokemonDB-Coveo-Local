"use client";

import { useEffect, useState } from "react";

type Subscribable<S> = {
  readonly state: S;
  subscribe(listener: () => void): () => void;
};

/** Subscribe to a Headless controller and mirror its state in React. */
export function useCoveoController<S>(controller: Subscribable<S>): S {
  const [state, setState] = useState(controller.state);

  useEffect(() => {
    const unsub = controller.subscribe(() => setState(controller.state));
    return unsub;
  }, [controller]);

  return state;
}
