/**
 * Google Drive Service — Armazenamento de Termos de Consentimento
 *
 * CONFIGURACAO:
 * 1. Acesse https://console.cloud.google.com
 * 2. Crie/selecione um projeto e ative "Google Drive API"
 * 3. Credenciais -> Criar ID do cliente OAuth 2.0 (Aplicativo da Web)
 * 4. Origens JS autorizadas: http://localhost:5173 + seu dominio de producao
 * 5. Copie o Client ID e defina no .env como VITE_GOOGLE_CLIENT_ID
 * 6. (Opcional) VITE_GOOGLE_DRIVE_FOLDER_ID para salvar em pasta especifica
 */

import { jsPDF } from "jspdf";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '';

export const TERMO_PDF_EMBED_URL = 'https://drive.google.com/file/d/15RZmnqkOVbTpkMAOEkmAujTwrOobHC6u/preview';
export const TERMO_PDF_VIEW_URL = 'https://drive.google.com/file/d/15RZmnqkOVbTpkMAOEkmAujTwrOobHC6u/view?usp=drive_link';

let _accessToken = null;
let _tokenExpiry = 0;

async function loadGsi() {
  if (window.google?.accounts?.oauth2) return;
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('GSI timeout')); }, 10000);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'));
    document.head.appendChild(script);
  });
}

async function getAccessToken() {
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID nao configurado no .env');
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  await loadGsi();
  const tryAuth = (prompt) =>
    new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          _accessToken = resp.access_token;
          _tokenExpiry = Date.now() + (Number(resp.expires_in) - 60) * 1000;
          resolve(_accessToken);
        },
      });
      client.requestAccessToken({ prompt });
    });
  try { return await tryAuth('none'); } catch { return await tryAuth('select_account'); }
}

export async function uploadTermoConsentimento({ pacienteNome, dataAssinatura, telefone, objetivos, expectativas, signatureDataUrl }) {
  if (!GOOGLE_CLIENT_ID) {
    console.warn('Google Drive nao configurado. Defina VITE_GOOGLE_CLIENT_ID no .env');
    return null;
  }
  const token = await getAccessToken();
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("TERMO DE CONSENTIMENTO", 105, 18, null, null, "center");
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text("Registro Digital e Aceite — Procedimentos Estéticos", 105, 28, null, null, "center");
  
  // Reset colors for body
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text(`Paciente: ${pacienteNome}`, 20, 45);
  if (telefone) doc.text(`Telefone: ${telefone}`, 20, 52);
  doc.text(`Data da Assinatura: ${dataAssinatura}`, 20, 59);
  doc.text(`Data do Registro: ${agora}`, 20, 66);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 72, 190, 72);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("DECLARAÇÃO", 20, 82);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const textBody = "A paciente declarou, sob as penas da lei, ter lido, compreendido e concordado plenamente com o Termo de Consentimento Livre e Esclarecido para a realizacao dos procedimentos esteticos. A assinatura digital foi colhida e confirmada com sucesso em ambiente autenticado pelo sistema PAIEMAE.";
  const splitText = doc.splitTextToSize(textBody, 170);
  doc.text(splitText, 20, 90);
  
  let y = 90 + (splitText.length * 6) + 10;
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;
  
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("OBJETIVOS DO TRATAMENTO", 20, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  y += 8;
  const objText = doc.splitTextToSize((objetivos && objetivos.length > 0) ? objetivos.join(', ') : "Nao especificado", 170);
  doc.text(objText, 20, y);
  y += (objText.length * 6) + 5;
  
  if (expectativas) {
    const splitExp = doc.splitTextToSize(`Expectativas: ${expectativas}`, 170);
    doc.text(splitExp, 20, y);
    y += (splitExp.length * 6) + 5;
  }
  
  // Signature section
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("ASSINATURA DIGITAL DO PACIENTE", 20, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', 20, y, 170, 45);
      y += 50;
    } catch (e) { y += 5; }
  }

  doc.setDrawColor(100, 100, 100);
  doc.line(20, y, 120, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(pacienteNome, 20, y);
  y += 4;
  doc.text(dataAssinatura, 20, y);
  
  // Footer
  y += 14;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento gerado automaticamente pelo sistema PAIEMAE — " + agora, 105, y, null, null, "center");
  
  const pdfBlob = doc.output('blob');

  const nomeSanitizado = pacienteNome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  const dataFmt = dataAssinatura.replace(/\//g, '-');
  const fileName = `TERMO_${nomeSanitizado}_${dataFmt}.pdf`;

  const metadata = { name: fileName, mimeType: 'application/pdf', ...(GOOGLE_DRIVE_FOLDER_ID ? { parents: [GOOGLE_DRIVE_FOLDER_ID] } : {}) };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', pdfBlob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body }
  );
  if (res.status === 401) { _accessToken = null; _tokenExpiry = 0; return uploadTermoConsentimento({ pacienteNome, dataAssinatura, telefone, objetivos, expectativas, comoConheceu }); }
  if (!res.ok) { const t = await res.text(); throw new Error('Google Drive API ' + res.status + ': ' + t); }
  return await res.json();
}

export const driveConfigurado = () => Boolean(GOOGLE_CLIENT_ID);
