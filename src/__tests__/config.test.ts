import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerConfigCommand } from '../commands/config';
import { setConfig, getConfig, clearConfig } from '../utils/config';
import { select, input } from '@vr_patel/tui';

vi.mock('../utils/config', () => ({
  setConfig: vi.fn(),
  getConfig: vi.fn(() => ({})),
  clearConfig: vi.fn(),
  clearNotificationCredentials: vi.fn(),
}));

vi.mock('@vr_patel/tui', () => ({
  select: vi.fn(),
  input: vi.fn(),
}));

describe('config command', () => {
  let program: Command;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerConfigCommand(program);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should register config setup, set, list, and clear commands', () => {
    const configCmd = program.commands.find((c) => c.name() === 'config');
    expect(configCmd).toBeDefined();
    expect(configCmd?.commands.map((c) => c.name())).toEqual(['setup', 'set', 'list', 'clear']);
  });

  it('should clear credentials and set service to none', async () => {
    (select as any).mockResolvedValue('none');
    await program.parseAsync(['node', 'test', 'config', 'setup']);
    
    const { setConfig } = await import('../utils/config');
    expect(select).toHaveBeenCalled();
    expect(setConfig).toHaveBeenCalledWith('notification_service', 'none');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Notifications disabled/i));
  });

  it('should call select, input and setConfig on discord setup', async () => {
    (select as any).mockResolvedValue('discord');
    (input as any).mockResolvedValue('https://discord.com/api/webhooks/123/abc');
    await program.parseAsync(['node', 'test', 'config', 'setup']);
    
    const { setConfig } = await import('../utils/config');
    expect(select).toHaveBeenCalled();
    expect(input).toHaveBeenCalled();
    expect(setConfig).toHaveBeenCalledWith('notification_service', 'discord');
    expect(setConfig).toHaveBeenCalledWith('discord_webhook', 'https://discord.com/api/webhooks/123/abc');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Discord Webhook configured/i));
  });

  it('should call select, multiple inputs and setConfig on email setup', async () => {
    (select as any).mockResolvedValue('email');
    (input as any)
      .mockResolvedValueOnce('smtp.gmail.com') // host
      .mockResolvedValueOnce('587')            // port
      .mockResolvedValueOnce('user@test.com')  // user
      .mockResolvedValueOnce('to@test.com');    // to

    await program.parseAsync(['node', 'test', 'config', 'setup']);
    
    const { setConfig } = await import('../utils/config');
    expect(setConfig).toHaveBeenCalledWith('notification_service', 'email');
    expect(setConfig).toHaveBeenCalledWith('email_host', 'smtp.gmail.com');
    expect(setConfig).toHaveBeenCalledWith('email_port', 587);
    expect(setConfig).toHaveBeenCalledWith('email_user', 'user@test.com');
    expect(setConfig).toHaveBeenCalledWith('email_to', 'to@test.com');
  });

  it('should call setConfig on config set', async () => {
    await program.parseAsync(['node', 'test', 'config', 'set', 'alert_email', 'test@test.com']);
    expect(setConfig).toHaveBeenCalledWith('alert_email', 'test@test.com');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Set alert_email to test@test.com'));
  });

  it('should parse integer for alert_cooldown', async () => {
    await program.parseAsync(['node', 'test', 'config', 'set', 'alert_cooldown', '123']);
    expect(setConfig).toHaveBeenCalledWith('alert_cooldown', 123);
  });

  it('should call getConfig on config list', async () => {
    (getConfig as any).mockReturnValue({ alert_cooldown: 100 });
    await program.parseAsync(['node', 'test', 'config', 'list']);
    expect(getConfig).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('alert_cooldown'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('100'));
  });

  it('should call clearConfig on config clear', async () => {
    await program.parseAsync(['node', 'test', 'config', 'clear']);
    expect(clearConfig).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration cleared'));
  });
});
