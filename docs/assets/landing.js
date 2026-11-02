const dialog = document.querySelector('.interest-dialog');

document.querySelectorAll('[data-interest]').forEach((button) => {
  button.addEventListener('click', () => {
    if (dialog?.showModal) dialog.showModal();
  });
});

document.querySelectorAll('[data-dialog-close]').forEach((button) => {
  button.addEventListener('click', () => dialog?.close());
});

dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
