import { Agent } from 'undici';
import type { Dispatcher } from 'undici';

// Fetch supplies its own five-minute defaults, overriding Agent constructor options.
// Override at dispatch time so quiet compaction streams get the SDK's full bound.
export class TrueForgeTransport extends Agent {
  override dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
    return super.dispatch({ ...options, headersTimeout: 600_000, bodyTimeout: 600_000 }, handler);
  }
}
