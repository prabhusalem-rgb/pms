export interface ExcelColumn {
  header: string;
  key: string;
  width?: number; // width in characters
  type?: 'string' | 'number' | 'currency' | 'percent' | 'date';
}

export function exportToExcel(
  filename: string,
  sheetName: string,
  columns: ExcelColumn[],
  data: any[]
) {
  // Build XML structure
  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>PMS System</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
      <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
      </Borders>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="StringLeft">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="StringCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="NumberThreeDec">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <NumberFormat ss:Format="#,##0.000"/>
    </Style>
    <Style ss:ID="CurrencyOMR">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <NumberFormat ss:Format="&quot;OMR&quot;\ #,##0.000"/>
    </Style>
    <Style ss:ID="Percent">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <NumberFormat ss:Format="0.00%"/>
    </Style>
    <Style ss:ID="DateCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <NumberFormat ss:Format="yyyy\-mm\-dd"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${sheetName.replace(/[\\/?*\[\]]/g, '').slice(0, 31)}">
    <Table>`;

  // Write Column widths
  columns.forEach(col => {
    const widthVal = col.width ? col.width * 7.5 : 120;
    xml += `\n      <Column ss:Width="${widthVal}"/>`;
  });

  // Header Row
  xml += `\n      <Row ss:Height="28">`;
  columns.forEach(col => {
    xml += `\n        <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`;
  });
  xml += `\n      </Row>`;

  // Data Rows
  data.forEach(row => {
    xml += `\n      <Row ss:Height="20">`;
    columns.forEach(col => {
      const val = row[col.key];
      let cellXml = '';

      if (val === null || val === undefined) {
        cellXml = `<Cell ss:StyleID="StringLeft"><Data ss:Type="String"></Data></Cell>`;
      } else if (col.type === 'number') {
        const numVal = parseFloat(val);
        if (isNaN(numVal)) {
          cellXml = `<Cell ss:StyleID="StringLeft"><Data ss:Type="String">${escapeXml(val.toString())}</Data></Cell>`;
        } else {
          cellXml = `<Cell ss:StyleID="NumberThreeDec"><Data ss:Type="Number">${numVal}</Data></Cell>`;
        }
      } else if (col.type === 'currency') {
        const numVal = parseFloat(val);
        if (isNaN(numVal)) {
          cellXml = `<Cell ss:StyleID="StringLeft"><Data ss:Type="String">${escapeXml(val.toString())}</Data></Cell>`;
        } else {
          cellXml = `<Cell ss:StyleID="CurrencyOMR"><Data ss:Type="Number">${numVal}</Data></Cell>`;
        }
      } else if (col.type === 'percent') {
        const numVal = parseFloat(val) / 100;
        if (isNaN(numVal)) {
          cellXml = `<Cell ss:StyleID="StringLeft"><Data ss:Type="String">${escapeXml(val.toString())}</Data></Cell>`;
        } else {
          cellXml = `<Cell ss:StyleID="Percent"><Data ss:Type="Number">${numVal}</Data></Cell>`;
        }
      } else if (col.type === 'date') {
        cellXml = `<Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escapeXml(val.toString())}</Data></Cell>`;
      } else {
        const styleId = col.key === 'item_code' || col.key === 'unit' || col.key === 'grn_number' || col.key === 'po_number' || col.key === 'issue_number' ? 'StringCenter' : 'StringLeft';
        cellXml = `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(val.toString())}</Data></Cell>`;
      }
      xml += `\n        ${cellXml}`;
    });
    xml += `\n      </Row>`;
  });

  xml += `\n    </Table>
  </Worksheet>
</Workbook>`;

  // Create a blob and download it
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
