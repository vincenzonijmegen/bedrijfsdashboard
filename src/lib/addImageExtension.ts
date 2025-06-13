import Image from "@tiptap/extension-image";
import type { CommandProps } from "@tiptap/core";

export function addImageExtension(onUpload: (file: File) => Promise<string>) {
  return Image.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        allowBase64: true,
        inline: false,
      };
    },

    addCommands() {
      return {
        ...this.parent?.(),
        setImageFromUpload:
          () =>
            async (props: CommandProps) => {
              const { chain } = props;

              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.click();

              return new Promise((resolve) => {
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (file) {
                    const url = await onUpload(file);
                    chain().focus().setImage({ src: url }).run();
                  }
                  resolve(true);
                };
              });
            },
      };
    },

    addKeyboardShortcuts() {
      return {
        ...this.parent?.(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "Mod-Shift-I": () => (this.editor.commands as any).setImageFromUpload(),
      };
    },
  });
}
