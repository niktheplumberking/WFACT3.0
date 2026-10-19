/**
 * Step 21 J: the one scripted model test double. hermes, frontend-loop, planning and verification each had a copy-pasted
 * MockModelClient (or MockJsonClient); each now extends one of these with its own request type, so the behaviour
 * (every request recorded, the scripted answer chosen by call index, a scripted Error thrown) lives in one place.
 * Test-only: deterministic, no network, no key. Nothing in a runtime path constructs it.
 */

/** Records every request and answers from a script. A script that returns an Error makes the call throw it. */
export class ScriptedModel<Req, Out> {
  readonly name = "mock";
  readonly calls: Req[] = [];

  constructor(private readonly respond: (request: Req, callIndex: number) => Out | Error) {}

  protected next(request: Req): Out {
    const out = this.respond(request, this.calls.length);
    this.calls.push(request);
    if (out instanceof Error) throw out;
    return out;
  }
}

/** A text model (`complete`). `family` lets a test give two mocks distinct model families (Step 7 cross-model rule). */
export class MockTextModel<Req> extends ScriptedModel<Req, string> {
  constructor(respond: (request: Req, callIndex: number) => string | Error, readonly family?: string) {
    super(respond);
  }

  async complete(request: Req): Promise<string> {
    return this.next(request);
  }
}

/** A structured-output model (`completeJson`). Each answer is a fresh copy, so a test cannot mutate the script. */
export class MockJsonModel<Req> extends ScriptedModel<Req, unknown> {
  readonly route = null;
  readonly totalUsage = { inputTokens: 0, outputTokens: 0 };

  async completeJson(request: Req): Promise<unknown> {
    return structuredClone(this.next(request));
  }
}
