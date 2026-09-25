/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./parts.tsx";

afterEach(cleanup);

describe("pencere arka planı", () => {
  function setup() {
    const onClose = vi.fn();
    render(
      <Modal title="Deneme" onClose={onClose}>
        <input aria-label="kutu" />
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement as HTMLElement;
    return { onClose, backdrop, input: screen.getByLabelText("kutu") };
  }

  it("kutuda basıp dışarıda bırakınca (metin seçerken) kapanmaz", () => {
    const { onClose, backdrop, input } = setup();
    fireEvent.pointerDown(input);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("arka plana basıp bırakınca kapanır", () => {
    const { onClose, backdrop } = setup();
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
