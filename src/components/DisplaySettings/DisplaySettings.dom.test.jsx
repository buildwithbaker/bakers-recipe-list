// @vitest-environment jsdom
// The Display control: a bottom sheet on a phone, a dropdown wider up. Both
// close on Escape and hand focus back to the button; the switches are real
// switches that a keyboard can flip.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisplaySettings from './DisplaySettings.jsx';

function Harness({ showWhyRow = true, onChange = () => {} }) {
  const [settings, setSettings] = useState({ why: true, amounts: true });
  return (
    <DisplaySettings
      settings={settings}
      showWhyRow={showWhyRow}
      onChange={(name, on) => { setSettings((s) => ({ ...s, [name]: on })); onChange(name, on); }}
    />
  );
}

const setWide = (wide) => {
  vi.stubGlobal('matchMedia', (q) => ({ matches: wide && q === '(min-width: 720px)', media: q }));
};
const button = () => screen.getByRole('button', { name: 'Display' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
});

describe('DisplaySettings on a phone (bottom sheet)', () => {
  it('opens a modal sheet with a handle, both switches and Done', () => {
    setWide(false);
    render(<Harness />);
    fireEvent.click(button());
    const dialog = screen.getByRole('dialog', { name: 'Display' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.hasAttribute('data-hides-tabbar')).toBe(true);
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-checked'))).toEqual(['true', 'true']);
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(button().getAttribute('aria-expanded')).toBe('true');
  });

  it('moves focus in, and Escape closes it and returns focus to the button', () => {
    setWide(false);
    render(<Harness />);
    fireEvent.click(button());
    expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Why notes' }));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('closes on the scrim and on Done', () => {
    setWide(false);
    const { container } = render(<Harness />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button());

    fireEvent.click(button());
    fireEvent.click(document.body.querySelector('[aria-hidden="true"][class*="scrim"]'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container).toBeTruthy();
  });

  it('keeps Escape to itself, so a recipe modal behind it stays open', () => {
    setWide(false);
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    try {
      render(<Harness />);
      fireEvent.click(button());
      fireEvent.keyDown(document.activeElement, { key: 'Escape' });
      expect(behind).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', behind);
    }
  });

  it('applies a switch live, as it is tapped', () => {
    setWide(false);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole('switch', { name: 'Amounts in steps' }));
    expect(onChange).toHaveBeenCalledWith('amounts', false);
    expect(screen.getByRole('switch', { name: 'Amounts in steps' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('DisplaySettings wider up (dropdown)', () => {
  it('opens a non-modal panel with no scrim, focus inside', () => {
    setWide(true);
    render(<Harness />);
    fireEvent.click(button());
    const dialog = screen.getByRole('dialog', { name: 'Display' });
    expect(dialog.hasAttribute('aria-modal')).toBe(false);
    expect(document.body.querySelector('[class*="scrim"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and returns focus to the button', () => {
    setWide(true);
    render(<Harness />);
    fireEvent.click(button());
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('closes on a click outside, and not on a click inside', () => {
    setWide(true);
    render(<><Harness /><p>elsewhere</p></>);
    fireEvent.click(button());
    fireEvent.pointerDown(screen.getByRole('switch', { name: 'Why notes' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DisplaySettings switches', () => {
  it('flip with Space and Enter from the keyboard', async () => {
    setWide(true);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button());
    const why = screen.getByRole('switch', { name: 'Why notes' });
    expect(document.activeElement).toBe(why);
    await user.keyboard(' ');
    expect(why.getAttribute('aria-checked')).toBe('false');
    await user.keyboard('{Enter}');
    expect(why.getAttribute('aria-checked')).toBe('true');
  });

  it('describe themselves with their hint', () => {
    setWide(true);
    render(<Harness />);
    fireEvent.click(button());
    const amounts = screen.getByRole('switch', { name: 'Amounts in steps' });
    const hint = document.getElementById(amounts.getAttribute('aria-describedby'));
    expect(hint.textContent).toBe('Quantities inside each step, like (1 tsp)');
  });

  it('leave out the Why notes row when asked', () => {
    setWide(true);
    render(<Harness showWhyRow={false} />);
    fireEvent.click(button());
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-labelledby') && s.textContent))
      .toEqual([expect.stringContaining('Amounts in steps')]);
    expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Amounts in steps' }));
  });
});
