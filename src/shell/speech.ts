import { status} from "./dom.js";
import { reason } from "../core/errors.js";
import { synthesise } from "../backend/index.js";
import { t } from "../core/texts.js";

// A voice given here is listened to instead of the saved one - that is what
// lets the picker play a voice before it is chosen.
//
// `button` may be null, and the voice picker is why. Its ▶ belongs to
// @lautstark/stimmquelle/voice-picker, which already disables it and writes
// "…" on it for as long as this runs - two writers of one label is how a
// button ends up stuck saying something after the sound has stopped. The
// editors' own play buttons are nobody else's and still hand theirs in.
export async function speak(text: string, button: HTMLElement | null,
                            voice?: string) {
  if (!text.trim()) { status(t("ui.need_text")); return; }
  // Nothing here refuses an empty layout.voice any more, and the sentence that
  // used to - "no voice chosen yet, pick one in the gear" - has gone with it.
  // An empty field is not the absence of an answer now: the Sammlung's
  // language picks one, the sheet marks it and says nobody chose it, and
  // synthesise() resolves the same default rather than sending an empty name
  // to the catalogue. Telling somebody to go and pick a voice while the gear
  // shows one ticked was the contradiction; the guard was written for the
  // nameless refusal underneath it, and there is no longer a path to it.
  const before = button?.textContent;
  if (button) button.textContent = "···";
  /* The blob is let go of when the sound is finished with, and "finished" has
     three spellings. `ended` was the only one handled, and it never comes for a
     sound that did not start: play() rejects under an autoplay rule or on a
     format this browser will not decode, and a decode that fails part-way
     fires `error` rather than `ended`. Each of those kept a recording - seconds
     of WAV, for a listen somebody did not even hear - for the life of the
     page. Revoking twice is harmless, so the three paths do not coordinate. */
  let url = "";
  try {
    url = URL.createObjectURL(await synthesise(text, voice));
    const audio = new Audio(url);
    const done = () => URL.revokeObjectURL(url);
    audio.onended = done;
    audio.onerror = done;
    await audio.play();
    status("");
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    status(t("ui.play_failed", { error: reason(error) }));
  } finally {
    if (button) button.textContent = before ?? "";
  }
}
