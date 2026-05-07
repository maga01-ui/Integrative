export async function exportPazientiExcel(studioId: string) {
  return {
    filename: `pazienti-${studioId}.xlsx`,
    content: Buffer.from('')
  }
}

export async function exportLeadsCsv(studioId: string) {
  return {
    filename: `leads-${studioId}.csv`,
    content: Buffer.from('')
  }
}

export async function exportFatturePdf(studioId: string, anno: number) {
  return {
    filename: `fatture-${studioId}-${anno}.pdf`,
    content: Buffer.from('')
  }
}
