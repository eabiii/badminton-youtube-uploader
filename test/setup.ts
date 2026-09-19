import '@testing-library/jest-dom/vitest';

const dialogElement = (
  globalThis as unknown as {
    HTMLDialogElement?: {
      prototype: {
        showModal?: (this: { open: boolean }) => void;
        close?: (this: { open: boolean }) => void;
      };
    };
  }
).HTMLDialogElement;

if (dialogElement && !dialogElement.prototype.showModal) {
  dialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (dialogElement && !dialogElement.prototype.close) {
  dialogElement.prototype.close = function close() {
    this.open = false;
  };
}
