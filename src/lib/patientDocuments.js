export const PATIENT_DOCUMENT_TYPES = [
  {
    id: 'procedure_consent',
    label: 'Termo de consentimento do procedimento',
    shortLabel: 'Consentimento',
    requiresProcedure: true,
    description: 'Registra que o procedimento, os cuidados e os riscos foram explicados e aceitos.',
  },
  {
    id: 'image_authorization',
    label: 'Autorização de uso de imagem',
    shortLabel: 'Uso de imagem',
    requiresProcedure: false,
    description: 'Define exatamente onde as imagens podem ser usadas e permite revogação futura.',
  },
  {
    id: 'responsibility_term',
    label: 'Termo de responsabilidade',
    shortLabel: 'Responsabilidade',
    requiresProcedure: true,
    description: 'Formaliza a veracidade das informações e o compromisso com os cuidados orientados.',
  },
  {
    id: 'service_agreement',
    label: 'Contrato de prestação de serviço',
    shortLabel: 'Contrato',
    requiresProcedure: true,
    description: 'Registra o serviço contratado, quantidade de sessões e condições combinadas.',
  },
];

export const IMAGE_USE_SCOPES = [
  { id: 'clinical_record', label: 'Prontuário e acompanhamento clínico' },
  { id: 'educational', label: 'Conteúdo educativo ou científico, sem identificação direta' },
  { id: 'marketing', label: 'Divulgação institucional, site e redes sociais' },
];

export function patientDocumentType(type) {
  return PATIENT_DOCUMENT_TYPES.find((item) => item.id === type) || PATIENT_DOCUMENT_TYPES[0];
}

export function buildPatientDocumentContent({
  type,
  patientName,
  procedureName,
  professionalName,
  sessionCount,
  contractAmount,
  paymentTerms,
  imageScopes = [],
}) {
  const patient = patientName || '[PACIENTE]';
  const procedure = procedureName || '[SERVIÇO/PROCEDIMENTO]';
  const professional = professionalName || '[PROFISSIONAL RESPONSÁVEL]';

  if (type === 'image_authorization') {
    const scopes = IMAGE_USE_SCOPES
      .filter((scope) => imageScopes.includes(scope.id))
      .map((scope) => `• ${scope.label}`)
      .join('\n');
    return `AUTORIZAÇÃO DE USO DE IMAGEM\n\nEu, ${patient}, autorizo, de forma livre e informada, a captação e o uso de minha imagem exclusivamente para as finalidades assinaladas abaixo:\n\n${scopes || '• [FINALIDADES AUTORIZADAS]'}\n\nA clínica deverá respeitar as finalidades escolhidas e não poderá utilizar as imagens de forma vexatória, discriminatória ou diferente do que foi autorizado. Esta autorização não condiciona a realização do atendimento.\n\nEstou ciente de que posso solicitar a interrupção de novos usos da imagem mediante manifestação expressa à clínica, preservados os tratamentos já realizados sob esta autorização e as hipóteses legais de conservação.\n\nDeclaro que li este documento, compreendi seu conteúdo e pude esclarecer minhas dúvidas antes da assinatura.`;
  }

  if (type === 'responsibility_term') {
    return `TERMO DE RESPONSABILIDADE\n\nEu, ${patient}, declaro que forneci informações verdadeiras, completas e atualizadas sobre minha saúde, medicamentos, alergias, tratamentos e demais condições relevantes para a realização de ${procedure}.\n\nComprometo-me a seguir as orientações recebidas de ${professional}, inclusive os cuidados anteriores e posteriores ao procedimento, e a comunicar imediatamente qualquer reação inesperada, alteração de saúde ou uso de novo medicamento.\n\nReconheço que omitir informações ou descumprir orientações pode aumentar riscos e prejudicar o resultado. Também compreendo que este termo não afasta a responsabilidade técnica da clínica e do profissional pelo atendimento prestado.\n\nDeclaro que li este documento, compreendi seu conteúdo e pude esclarecer minhas dúvidas antes da assinatura.`;
  }

  if (type === 'service_agreement') {
    const amount = contractAmount ? `R$ ${Number(contractAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '[VALOR A DEFINIR]';
    return `CONTRATO DE PRESTAÇÃO DE SERVIÇO\n\nCONTRATANTE: ${patient}\nSERVIÇO/PROCEDIMENTO: ${procedure}\nPROFISSIONAL RESPONSÁVEL: ${professional}\nQUANTIDADE DE SESSÕES: ${sessionCount || '[A DEFINIR]'}\nVALOR COMBINADO: ${amount}\nCONDIÇÕES DE PAGAMENTO: ${paymentTerms || '[A DEFINIR]'}\n\nA clínica prestará o serviço descrito acima conforme avaliação, indicação técnica, disponibilidade de agenda e protocolos aplicáveis. A pessoa contratante compromete-se a informar corretamente suas condições de saúde, comparecer nos horários combinados e seguir as orientações recebidas.\n\nRemarcações, cancelamentos, validade do plano, uso de sessões e eventual reembolso seguirão as condições informadas pela clínica e registradas neste documento. Alterações do plano deverão ser formalizadas entre as partes.\n\nResultados podem variar conforme características individuais e adesão às orientações, não havendo promessa de resultado absoluto.\n\nDeclaro que li as condições, compreendi o serviço contratado e pude esclarecer minhas dúvidas antes da assinatura.`;
  }

  return `TERMO DE CONSENTIMENTO DO PROCEDIMENTO\n\nEu, ${patient}, declaro que recebi explicações claras de ${professional} sobre o procedimento ${procedure}, sua finalidade, forma de realização, benefícios esperados, limitações, alternativas, cuidados necessários, contraindicações e possíveis riscos.\n\nAs condições específicas do procedimento e as informações de saúde relevantes constam na ficha de anamnese e no termo específico correspondente, quando aplicável, que integram o meu registro de atendimento.\n\nCompreendo que os resultados variam de pessoa para pessoa e que não existe garantia de resultado exato. Comprometo-me a seguir as orientações anteriores e posteriores ao procedimento e a informar imediatamente qualquer reação inesperada.\n\nConfirmo que pude fazer perguntas, recebi respostas satisfatórias e autorizo a realização do procedimento descrito acima.`;
}

export function patientDocumentStatus(document) {
  if (document?.status === 'revoked') return { label: 'Revogado', color: '#DC2626', background: '#FEE2E2' };
  if (document?.status === 'signed') return { label: 'Assinado', color: '#047857', background: '#D1FAE5' };
  return { label: 'Pendente', color: '#B45309', background: '#FEF3C7' };
}

export function validatePatientDocumentDraft(draft) {
  const type = patientDocumentType(draft.type);
  if (!draft.clientId) return 'Selecione o paciente.';
  if (type.requiresProcedure && !draft.procedureName?.trim()) return 'Informe o serviço ou procedimento.';
  if (draft.type === 'image_authorization' && !draft.imageScopes?.length) return 'Escolha ao menos uma finalidade para o uso da imagem.';
  if (!draft.content?.trim()) return 'O texto do documento não pode ficar vazio.';
  return '';
}
