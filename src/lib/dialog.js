/** Native dialog provides focus trapping and Escape; restore focus on every close. */
export function setupDialog(dialog) {
  let returnFocus;
  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    if (event.target === dialog && outside) dialog.close();
  });
  dialog.addEventListener('close', () => returnFocus?.focus());
  return {
    open() {
      returnFocus = document.activeElement;
      dialog.showModal();
    },
  };
}
