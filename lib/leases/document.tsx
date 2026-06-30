import {
  Document, Page, StyleSheet, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

import { parseClauseMarkdown, type Inline } from "@/lib/leases/markdown";
import { applyPlaceholders, leasePlaceholders } from "@/lib/leases/placeholders";
import { mergeClauses } from "@/lib/leases/templates";
import type { LeaseClause } from "@/lib/leases/types";
import type { LeaseRow } from "@/lib/supabase/types";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, lineHeight: 1.5, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 9, marginBottom: 20, textAlign: "center", color: "#555" },
  clauseTitle: { fontSize: 12, marginTop: 14, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  para: { marginBottom: 6 },
  bullet: { marginBottom: 3, marginLeft: 12 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  sigBox: { width: 200, borderTop: "1pt solid #000", paddingTop: 4, fontSize: 9 },
});

function runStyle(run: Inline) {
  if (run.bold) return { fontFamily: "Helvetica-Bold" };
  if (run.italic) return { fontFamily: "Helvetica-Oblique" };
  return {};
}

function ClauseBody({ markdown }: { markdown: string }) {
  const blocks = parseClauseMarkdown(markdown);
  return (
    <>
      {blocks.map((block, i) => (
        <Text key={i} style={block.type === "bullet" ? styles.bullet : styles.para}>
          {block.type === "bullet" ? "• " : ""}
          {block.runs.map((run, j) => (
            <Text key={j} style={runStyle(run)}>{run.text}</Text>
          ))}
        </Text>
      ))}
    </>
  );
}

export function LeaseDocument({
  lease, clauses,
}: { lease: LeaseRow; clauses: LeaseClause[] }) {
  const values = leasePlaceholders(lease);
  const merged = mergeClauses(
    clauses,
    (lease.clause_overrides as Record<string, string>) ?? {}
  );
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Tenancy Agreement</Text>
        <Text style={styles.subtitle}>
          {lease.code ?? ""} · Governed by the Laws of Kenya
        </Text>
        {merged.map((clause) => (
          <View key={clause.key} wrap={false}>
            <Text style={styles.clauseTitle}>{clause.title}</Text>
            <ClauseBody markdown={applyPlaceholders(clause.body_markdown, values)} />
          </View>
        ))}
        <View style={styles.sigRow}>
          <Text style={styles.sigBox}>Landlord: {values.landlord_name}</Text>
          <Text style={styles.sigBox}>Tenant: {values.tenant_name}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderLeasePdf(
  lease: LeaseRow, templateClauses: LeaseClause[]
): Promise<Buffer> {
  return renderToBuffer(<LeaseDocument lease={lease} clauses={templateClauses} />);
}
