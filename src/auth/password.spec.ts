import { hashPassword, verifyPassword } from './password';
describe('Account passwords', () => {
  it('salts hashes and rejects wrong passwords', async () => {
    const first = await hashPassword('player-password');
    expect(first).not.toBe(await hashPassword('player-password'));
    expect(await verifyPassword('player-password',first)).toBe(true);
    expect(await verifyPassword('wrong-password',first)).toBe(false);
    expect(await verifyPassword('player-password','invalid')).toBe(false);
  });
});
