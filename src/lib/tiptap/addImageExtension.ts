import Image from "@tiptap/extension-image";

export function addImageExtension(onUpload: (file: File) => Promise<string>) {
  return Image.extend({
    addCommands() {
      return {
        ...this.parent?.(),
        setImageFromUpload:
          () =>
          async ({ chain }) => {
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
        "Mod-Shift-I": () => this.editor.commands.setImageFromUpload(),
      };
    },
  });
}
