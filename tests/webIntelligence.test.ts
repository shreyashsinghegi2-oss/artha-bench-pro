import { describe, expect, it } from 'vitest';
import { htmlToText, isPrivateAddress, linksIn, readWebPage } from '../server/webReader';
import { fundQueryFrom } from '../server/liveGrounding';

describe('web reader safety', () => {
  it('blocks private, loopback, link-local and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '142.250.72.14', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it('refuses internal and non-web links before fetching', async () => {
    await expect(readWebPage('http://localhost:3000/api')).rejects.toThrow(/cannot be read/);
    await expect(readWebPage('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/cannot be read/);
    await expect(readWebPage('file:///etc/passwd')).rejects.toThrow(/Only web links/);
    await expect(readWebPage('https://user:pw@example.com')).rejects.toThrow(/passwords/);
    await expect(readWebPage('not a url')).rejects.toThrow(/does not look like/);
  });
  it('turns HTML into readable text and finds links in a message', () => {
    const r = htmlToText('<html><head><title>Fund &amp; Co</title><meta name="description" content="A factsheet"></head><body><nav>menu</nav><script>x()</script><h1>NAV</h1><p>₹92.41 on 24 Sep</p></body></html>');
    expect(r).toEqual({ title: 'Fund & Co', description: 'A factsheet', text: 'NAV\n₹92.41 on 24 Sep' });
    expect(linksIn('Read https://example.com/a, and http://x.org/b.')).toEqual(['https://example.com/a', 'http://x.org/b']);
  });
});

describe('fund questions', () => {
  it('extracts the fund from a question, only when it names a fund house', () => {
    expect(fundQueryFrom('What is the NAV of HDFC Flexi Cap fund today?')).toBe('hdfc flexi cap');
    expect(fundQueryFrom('Should I start a SIP in Parag Parikh Flexi Cap?')).toBe('parag parikh flexi cap');
    expect(fundQueryFrom('What is a mutual fund?')).toBeNull();
    expect(fundQueryFrom('HDFC Bank share price')).toBeNull();
  });
});
