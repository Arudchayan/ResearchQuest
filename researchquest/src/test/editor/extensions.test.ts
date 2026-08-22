import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { basicSetup } from "@uiw/react-codemirror";

// Guards the CodeMirror single-instance contract: duplicate @codemirror/state instances crash EditorState.create.

const EXTENSIONS = [basicSetup(), markdown(), EditorView.lineWrapping];

describe("editor extensions", () => {
  it("creates an EditorState with basicSetup and markdown without throwing", () => {
    expect(() => EditorState.create({ extensions: EXTENSIONS })).not.toThrow();
  });

  it("applies an insert transaction to the document", () => {
    const view = new EditorView({
      state: EditorState.create({ extensions: EXTENSIONS }),
    });
    view.dispatch({ changes: { from: 0, insert: "Hello, world!" } });
    expect(view.state.doc.toString()).toBe("Hello, world!");
    view.destroy();
  });
});
