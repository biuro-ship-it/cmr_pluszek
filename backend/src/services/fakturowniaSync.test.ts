import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceNumberFromNote, normalizeVat, planBulkSync, SyncClient } from './fakturowniaSync';
import { FakturowniaSalesInvoice } from './fakturownia';

const inv = (id: number, buyerTaxNo: string, priceNet: number, issueDate: string, extra: Partial<FakturowniaSalesInvoice> = {}): FakturowniaSalesInvoice => ({
  id, number: `FV/${id}`, issueDate, sellDate: issueDate, paymentTo: '', priceNet, priceGross: priceNet * 1.23,
  currency: 'PLN', status: 'paid', kind: 'vat',
  buyerTaxNo, buyerName: `Firma ${buyerTaxNo}`, buyerEmail: '', buyerPhone: '', buyerPerson: '',
  ...extra,
});

const NOW = '2026-09-26T12:00:00.000Z';
const TODAY = '2026-09-26';

describe('normalizeVat', () => {
  it('ujednolica polski NIP (myślniki, spacje, prefiks PL)', () => {
    assert.equal(normalizeVat('123-456-78-90'), '1234567890');
    assert.equal(normalizeVat('PL 1234567890'), '1234567890');
    assert.equal(normalizeVat('pl1234567890'), '1234567890');
  });
  it('pomija prefiks kraju zagranicznego VAT', () => {
    assert.equal(normalizeVat('CZ 12345678'), '12345678');
    assert.equal(normalizeVat('12345678'), '12345678');
  });
  it('odrzuca pusty lub za krótki numer', () => {
    assert.equal(normalizeVat('123'), '');
    assert.equal(normalizeVat(undefined), '');
  });
});

describe('invoiceNumberFromNote', () => {
  it('czyta numer z wpisu historii', () => {
    assert.equal(invoiceNumberFromNote('🧾 Faktura FV/12/2026: 1 234,00 zł netto'), 'FV/12/2026');
    assert.equal(invoiceNumberFromNote('Rozmowa telefoniczna'), '');
  });
});

describe('planBulkSync', () => {
  it('dopisuje do historii tylko faktury, których jeszcze nie ma', () => {
    const clients: SyncClient[] = [{ id: 'a', companyName: 'A', nip: '123-456-78-90', lastContactAt: '2026-01-01' }];
    const existing = new Map([['a', new Set(['FV/1'])]]);
    const { updates, summary } = planBulkSync(clients, [
      inv(1, 'PL1234567890', 100, '2026-03-01'),
      inv(2, '1234567890', 200, '2026-05-01'),
    ], existing, NOW, TODAY);

    assert.equal(updates.length, 1);
    const u = updates[0];
    assert.deepEqual(u.newInteractions.map(i => i.contactDate), ['2026-05-01']);
    assert.match(u.newInteractions[0].notes, /^🧾 Faktura FV\/2: 200,00 zł netto$/);
    assert.equal(u.newInteractions[0].channel, 'inne');
    assert.deepEqual((u.data.fakturowniaInvoices as { id: number }[]).map(i => i.id), [2, 1]);
    assert.equal(u.data.lastContactAt, '2026-05-01');
    assert.equal(summary.newInteractions, 1);
    assert.equal(summary.invoicesMatched, 2);
  });

  it('nie cofa „ostatniego kontaktu" przy starej fakturze', () => {
    const clients: SyncClient[] = [{ id: 'a', nip: '1234567890', lastContactAt: '2026-08-10T09:00:00.000Z' }];
    const { updates } = planBulkSync(clients, [inv(1, '1234567890', 100, '2026-02-01')], new Map(), NOW, TODAY);
    assert.equal(updates[0].newInteractions.length, 1);
    assert.equal('lastContactAt' in updates[0].data, false);
  });

  it('nie dubluje faktury o tym samym numerze w jednym przebiegu', () => {
    const clients: SyncClient[] = [{ id: 'a', nip: '1234567890' }];
    const { updates } = planBulkSync(clients, [
      inv(1, '1234567890', 100, '2026-02-01', { number: 'FV/X' }),
      inv(2, '1234567890', 100, '2026-02-01', { number: 'FV/X' }),
    ], new Map(), NOW, TODAY);
    assert.equal(updates[0].newInteractions.length, 1);
  });

  it('faktura bez daty trafia do historii z datą dzisiejszą', () => {
    const { updates } = planBulkSync([{ id: 'a', nip: '1234567890' }], [inv(1, '1234567890', 5, '')], new Map(), NOW, TODAY);
    assert.equal(updates[0].newInteractions[0].contactDate, TODAY);
  });

  it('dopasowuje zagraniczny VAT', () => {
    const { updates } = planBulkSync([{ id: 'cz', nip: 'CZ12345678' }], [
      inv(1, 'cz 12345678', 5, '2026-01-01'),
      inv(2, '12345678', 5, '2026-02-01'), // ten sam nabywca bez prefiksu
    ], new Map(), NOW, TODAY);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].newInteractions.length, 2);
  });

  it('uzupełnia dane kontaktowe tylko gdy puste i pomija błędny e-mail', () => {
    const clients: SyncClient[] = [
      { id: 'a', nip: '1111111111', email: 'stary@a.pl' },
      { id: 'b', nip: '2222222222' },
    ];
    const { updates } = planBulkSync(clients, [
      inv(1, '1111111111', 1, '2026-01-01', { buyerEmail: 'nowy@a.pl', buyerPhone: '600100200' }),
      inv(2, '2222222222', 1, '2026-02-01', { buyerEmail: 'x@b.pl, y@b.pl', buyerPerson: 'Jan' }),
      inv(3, '2222222222', 1, '2026-01-01', { buyerEmail: 'ok@b.pl' }),
    ], new Map(), NOW, TODAY);
    const a = updates.find(u => u.id === 'a')!.data;
    const b = updates.find(u => u.id === 'b')!.data;
    assert.equal('email' in a, false);
    assert.equal(a.phone, '600100200');
    assert.equal(b.email, 'ok@b.pl');
    assert.equal(b.contactPerson, 'Jan');
  });

  it('raportuje klientów bez NIP, bez faktur i nabywców spoza CRM', () => {
    const clients: SyncClient[] = [
      { id: 'a', companyName: 'Bez NIP' },
      { id: 'b', companyName: 'Bez faktur', nip: '9999999999' },
    ];
    const { updates, summary } = planBulkSync(clients, [
      inv(1, '5555555555', 1, '2026-01-01'),
      inv(2, '5555555555', 1, '2026-01-02'),
      inv(3, '', 1, '2026-01-03'),
    ], new Map(), NOW, TODAY);
    assert.equal(updates.length, 0);
    assert.deepEqual(summary.noNip, ['Bez NIP']);
    assert.deepEqual(summary.noInvoices, ['Bez faktur']);
    assert.deepEqual(summary.unmatchedBuyers, [{ nip: '5555555555', name: 'Firma 5555555555', count: 2 }]);
    assert.equal(summary.invoicesWithoutNip, 1);
  });
});
