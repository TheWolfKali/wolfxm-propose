import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import { LineItem, Contractor, Job } from '@/lib/types/database'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    padding: 48,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 32,
    borderBottom: '2px solid #2563eb',
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 8,
    objectFit: 'cover',
  },
  headerText: {
    flex: 1,
  },
  companyName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    color: '#6b7280',
    width: 80,
  },
  value: {
    fontSize: 9,
    color: '#1a1a1a',
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: '6 8',
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '5 8',
    borderBottom: '1px solid #f3f4f6',
  },
  colDesc: { flex: 3, fontSize: 9 },
  colQty: { width: 40, fontSize: 9, textAlign: 'right' },
  colUnit: { width: 40, fontSize: 9, textAlign: 'center' },
  colPrice: { width: 60, fontSize: 9, textAlign: 'right' },
  colTotal: { width: 70, fontSize: 9, textAlign: 'right' },
  colHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  totalsSection: {
    marginTop: 16,
    marginLeft: 'auto',
    width: 220,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  totalLabel: { fontSize: 9, color: '#6b7280' },
  totalValue: { fontSize: 9, color: '#1a1a1a' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#2563eb',
    borderRadius: 4,
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  grandTotalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  terms: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderLeft: '3px solid #2563eb',
  },
  termsText: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  validity: {
    marginTop: 12,
    fontSize: 9,
    color: '#374151',
    fontFamily: 'Helvetica-Bold',
  },
})

function formatCurrency(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface ProposalDocumentProps {
  contractor: Contractor
  job: Job
  lineItems: LineItem[]
  laborHours: number
  laborRate: number
  markupPct: number
  materialSubtotal: number
  laborCost: number
  subtotal: number
  markupAmount: number
  grandTotal: number
  proposalDate: string
  logoBase64?: string
}

export function ProposalDocument({
  contractor,
  job,
  lineItems,
  laborHours,
  laborRate,
  markupPct,
  materialSubtotal,
  laborCost,
  subtotal,
  markupAmount,
  grandTotal,
  proposalDate,
  logoBase64,
}: ProposalDocumentProps) {
  const jobTypeLabel = job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {logoBase64 && (
            <Image src={logoBase64} style={styles.logo} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.companyName}>{contractor.company_name}</Text>
            {contractor.license_no && (
              <Text style={styles.headerMeta}>License #{contractor.license_no}</Text>
            )}
            {contractor.zip && (
              <Text style={styles.headerMeta}>ZIP: {contractor.zip}</Text>
            )}
            <Text style={styles.headerMeta}>{contractor.email}</Text>
          </View>
        </View>

        {/* Proposal title */}
        <View style={styles.section}>
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 12 }}>
            PROPOSAL — {jobTypeLabel} Work
          </Text>

          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{proposalDate}</Text>
          </View>
          {job.address && (
            <View style={styles.row}>
              <Text style={styles.label}>Job Address:</Text>
              <Text style={styles.value}>{job.address}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Job Type:</Text>
            <Text style={styles.value}>{jobTypeLabel}</Text>
          </View>
        </View>

        {/* Scope of work */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scope of Work</Text>
          <Text style={{ fontSize: 9, color: '#374151', lineHeight: 1.6 }}>{job.description}</Text>
        </View>

        {/* Line items table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.colHeaderText]}>Description</Text>
            <Text style={[styles.colQty, styles.colHeaderText]}>Qty</Text>
            <Text style={[styles.colUnit, styles.colHeaderText]}>Unit</Text>
            <Text style={[styles.colPrice, styles.colHeaderText]}>Unit Price</Text>
            <Text style={[styles.colTotal, styles.colHeaderText]}>Total</Text>
          </View>

          {lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(item.qty * item.unitPrice)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Materials</Text>
            <Text style={styles.totalValue}>{formatCurrency(materialSubtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Labor ({laborHours}h @ ${laborRate}/hr)</Text>
            <Text style={styles.totalValue}>{formatCurrency(laborCost)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Markup ({markupPct}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(markupAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
          </View>
        </View>

        {/* Payment terms */}
        <View style={styles.terms}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 4 }}>
            Payment Terms
          </Text>
          <Text style={styles.termsText}>
            • 50% deposit required to schedule work{'\n'}
            • Remaining balance due upon completion{'\n'}
            • Accepted payment: check, ACH, or credit card (3% processing fee){'\n'}
            • All work performed to local code standards{'\n'}
            • Warranty: 1 year on labor, manufacturer warranty on materials
          </Text>
        </View>

        <Text style={styles.validity}>
          This proposal is valid for 30 days from the date above.
        </Text>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {contractor.company_name} · Powered by ContractIQ
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
