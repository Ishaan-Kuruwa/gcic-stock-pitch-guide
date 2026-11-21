import { useEffect, useState } from 'preact/hooks';
import { buttonSecondary, focus } from '../lib/styles';

interface Props {
  /** The text to copy, already shown as plain text on the page. */
  text: string;
  /** What is copied, for the button's accessible name, e.g. "join code". */
  label: string;
}

/**
 * A copy button for text that is already on the page. The button appears
 * only once JavaScript runs, so without JS there's no dead button: the text
 * is still there to select and copy by hand. The empty wrapper is always
 * rendered, because client:visible watches the island's children to know
 * when to hydrate.
 */
export default function CopyButton({ text, label }: Props) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setReady(typeof navigator !== 'undefined' && !!navigator.clipboard);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied.');
    } catch {
      setMessage("Couldn't copy. Select the code and copy it by hand.");
    }
  }

  if (!ready) return <span class="inline-flex" />;
  return (
    <span class="inline-flex flex-wrap items-center gap-3">
      <button type="button" onClick={copy} class={`${buttonSecondary} ${focus} cursor-pointer py-2`}>
        Copy <span class="sr-only">{label}</span>
      </button>
      <span role="status" class="font-bold">
        {message}
      </span>
    </span>
  );
}
