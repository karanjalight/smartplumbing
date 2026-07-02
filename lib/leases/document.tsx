import {
  Document, Page, StyleSheet, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

import { parseClauseMarkdown, type Inline } from "@/lib/leases/markdown";
import { applyPlaceholders, leasePlaceholders } from "@/lib/leases/placeholders";
import { mergeClauses } from "@/lib/leases/templates";
import type { LeaseClause } from "@/lib/leases/types";
import type { LeaseRow } from "@/lib/supabase/types";

const ACCENT = "#0A4266";
const INK = "#1A1A1A";
const MUTED = "#6B7280";

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingHorizontal: 48,
    paddingBottom: 150,
    fontSize: 10.5,
    lineHeight: 1.55,
    fontFamily: "Helvetica",
    color: INK,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  wordmark: { fontSize: 15, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 1 },
  tagline: { fontSize: 7.5, color: MUTED, letterSpacing: 0.5, marginTop: 1 },
  docType: { fontSize: 8, color: MUTED, letterSpacing: 1.5, textAlign: "right" },
  docCode: { fontSize: 9, fontFamily: "Helvetica-Bold", color: INK, textAlign: "right", marginTop: 2 },
  rule: { borderBottomWidth: 1.5, borderBottomColor: ACCENT, marginTop: 8 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 22, color: INK },
  meta: { fontSize: 8.5, color: MUTED, textAlign: "center", marginTop: 4 },
  clause: { marginTop: 13 },
  clauseTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: ACCENT, marginBottom: 3 },
  para: { marginBottom: 5 },
  bullet: { marginBottom: 2.5, marginLeft: 12 },
  spacer: { flexGrow: 1 },
  sigHeading: { fontSize: 11, fontFamily: "Helvetica-Bold", color: ACCENT, marginBottom: 4 },
  sigNote: { fontSize: 8, color: MUTED, lineHeight: 1.4 },
  footer: {
    position: "absolute", bottom: 26, left: 48, right: 48,
    borderTopWidth: 0.75, borderTopColor: "#D1D5DB", paddingTop: 6,
    flexDirection: "row", justifyContent: "space-between",
  },
  footerText: { fontSize: 7.5, color: MUTED },
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
          {block.type === "bullet" ? "•  " : ""}
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
    <Document
      title={`Tenancy Agreement ${lease.code ?? ""}`.trim()}
      author="Mali Smart"
    >
      <Page size="A4" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.wordmark}>MALI SMART</Text>
            <Text style={styles.tagline}>SMART WATER BILLING</Text>
          </View>
          <View>
            <Text style={styles.docType}>TENANCY AGREEMENT</Text>
            <Text style={styles.docCode}>{lease.code ?? ""}</Text>
          </View>
        </View>
        <View style={styles.rule} fixed />

        <Text style={styles.title}>Residential Tenancy Agreement</Text>
        <Text style={styles.meta}>
          {lease.code ? `${lease.code} · ` : ""}Governed by the Laws of Kenya
        </Text>

        {merged.map((clause) => (
          <View key={clause.key} style={styles.clause} wrap={false}>
            <Text style={styles.clauseTitle}>{clause.title}</Text>
            <ClauseBody markdown={applyPlaceholders(clause.body_markdown, values)} />
          </View>
        ))}

        <View style={styles.spacer} />

        <View wrap={false}>
          <Text style={styles.sigHeading}>Signatures</Text>
          <Text style={styles.sigNote}>
            Executed electronically by the parties below under the Kenya Information
            and Communications Act. Signatures and timestamps are recorded by Mali Smart.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Mali Smart{lease.code ? ` · ${lease.code}` : ""}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
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
