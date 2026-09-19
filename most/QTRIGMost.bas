Attribute VB_Name = "QTRIGMost"
' =====================================================================
'  QTRIG Kancelář ↔ MicroStation — živý most (VBA makro)
'  Verze 1 · 20. 9. 2026 · funguje v MicroStation V8i / CONNECT (VBA)
'
'  CO DĚLÁ
'   1. QTRIG_Prihlasit      – přihlásí se stejným účtem jako AR Geodet / Kancelář
'   2. QTRIG_StahnoutBody   – stáhne body cloudové zakázky a vloží je do výkresu
'                             (bod jako buňka/kříž + text s číslem, hladina = kód bodu)
'   3. QTRIG_ZivyMost       – spustí hlídání: každých N sekund dotáhne nové body
'                             (Kancelář: uložit bod → za pár sekund je v DGN)
'   4. QTRIG_PoslatVybrane  – vrcholy vybraných prvků (čáry, body, texty) pošle
'                             do zakázky → objeví se v Kanceláři (Účet → Stáhnout)
'   5. QTRIG_NacistSoubor   – bez cloudu: načte TXT (číslo Y X [Z] [kód]) ze složky
'
'  INSTALACE
'   MicroStation → Utilities → Macro → Project Manager → Load: tento .mvba,
'   nebo VBA editor (Alt+F11) → File → Import File → QTRIGMost.bas.
'   Spouštění: Utilities → Macro → Macros… → QTRIG_ZivyMost.
'   Nastav dole KOD_UCTU, HESLO, ZAKAZKA (název zakázky = název projektu v Kanceláři).
'
'  SOUŘADNICE: Kancelář posílá S-JTSK (Y, X kladné) v poli prov.y / prov.x a WGS84.
'   MicroStation v ČR obvykle kreslí „matematicky“: X_dgn = −Y_jtsk, Y_dgn = −X_jtsk.
'   Přepínač ZAPORNE níže. Jednotky výkresu = metry (Master units m).
'
'  POCTIVĚ: makro je napsané podle dokumentace MicroStation VBA, na tomto počítači
'   nešlo spustit (MicroStation tu není). První spuštění doladíme společně.
' =====================================================================
Option Explicit

Private Const API As String = "https://ar-geodet-api.ar-geodet.workers.dev"
Private Const KOD_UCTU As String = "TVUJ-KOD-UCTU"     ' kód účtu QTRIG (nebo kód firmy)
Private Const JMENO As String = ""                     ' jen u firemního účtu (jinak prázdné)
Private Const HESLO As String = "TVOJE-HESLO"
Private Const ZAKAZKA As String = "husovice"           ' název zakázky (malými písmeny, jako v Kanceláři)
Private Const ZAPORNE As Boolean = True                ' True: X_dgn = -Y, Y_dgn = -X (matematická soustava)
Private Const HLADINA_BODY As String = "QTRIG_BODY"
Private Const VYSKA_TEXTU As Double = 0.5              ' m
Private Const INTERVAL_S As Long = 5                   ' živý most: perioda dotazu

Private token As String
Private since As Double
Private vlozene As Object                              ' Scripting.Dictionary: id → True
Private bezi As Boolean

' ---------------------------------------------------------------- HTTP
Private Function Http(metoda As String, cesta As String, telo As String) As String
    Dim h As Object
    Set h = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    h.Open metoda, API & cesta, False
    h.setRequestHeader "Content-Type", "application/json"
    If Len(token) > 0 Then h.setRequestHeader "Authorization", "Bearer " & token
    If Len(telo) > 0 Then h.send telo Else h.send
    If h.Status <> 200 Then
        Err.Raise vbObjectError + 1, "QTRIG", "Server " & h.Status & ": " & Left$(h.responseText, 200)
    End If
    Http = h.responseText
End Function

' velmi jednoduché vytažení hodnoty z JSON (bez knihoven): "klic":"hodnota" nebo "klic":cislo
Private Function JsonHodnota(json As String, klic As String) As String
    Dim p As Long, q As Long, s As String
    p = InStr(1, json, """" & klic & """:")
    If p = 0 Then Exit Function
    p = p + Len(klic) + 3
    If Mid$(json, p, 1) = """" Then
        p = p + 1: q = p
        Do While q <= Len(json)
            If Mid$(json, q, 1) = """" And Mid$(json, q - 1, 1) <> "\" Then Exit Do
            q = q + 1
        Loop
        s = Mid$(json, p, q - p)
        JsonHodnota = Replace(Replace(s, "\/", "/"), "\""", """")
    Else
        q = p
        Do While q <= Len(json) And InStr("-0123456789.eE", Mid$(json, q, 1)) > 0: q = q + 1: Loop
        JsonHodnota = Mid$(json, p, q - p)
    End If
End Function

Private Function ToDouble(s As String) As Double
    If Len(s) = 0 Then ToDouble = 0 Else ToDouble = Val(s)
End Function

' ---------------------------------------------------------------- 1. přihlášení
Public Sub QTRIG_Prihlasit()
    Dim telo As String, odp As String
    telo = "{""code"":""" & KOD_UCTU & """,""password"":""" & HESLO & """"
    If Len(JMENO) > 0 Then telo = telo & ",""name"":""" & JMENO & """"
    telo = telo & "}"
    token = ""
    odp = Http("POST", "/login", telo)
    token = JsonHodnota(odp, "token")
    If Len(token) = 0 Then Err.Raise vbObjectError + 2, "QTRIG", "Přihlášení selhalo: " & Left$(odp, 200)
    ShowMessage "QTRIG: přihlášen", "", msdMessageCenterPriorityInfo
End Sub

' ---------------------------------------------------------------- vložení bodu do výkresu
Private Sub VlozBod(cislo As String, y As Double, x As Double, z As Double, kod As String)
    Dim p As Point3d, lv As Level, txt As TextElement, ln As LineElement, p1 As Point3d, p2 As Point3d
    If ZAPORNE Then
        p.X = -y: p.Y = -x
    Else
        p.X = y: p.Y = x
    End If
    p.Z = z
    ' hladina podle kódu (nebo QTRIG_BODY)
    Dim nazevHl As String
    nazevHl = HLADINA_BODY
    If Len(kod) > 0 Then nazevHl = "QTRIG_" & UCase$(Replace(kod, " ", "_"))
    Set lv = ActiveDesignFile.Levels.Find(nazevHl)
    If lv Is Nothing Then Set lv = ActiveDesignFile.AddNewLevel(nazevHl)
    ActiveSettings.Level = lv
    ' kříž 0,4 m jako značka bodu
    p1 = p: p2 = p: p1.X = p.X - 0.2: p2.X = p.X + 0.2
    Set ln = CreateLineElement2(Nothing, p1, p2): ActiveModelReference.AddElement ln
    p1 = p: p2 = p: p1.Y = p.Y - 0.2: p2.Y = p.Y + 0.2
    Set ln = CreateLineElement2(Nothing, p1, p2): ActiveModelReference.AddElement ln
    ' text s číslem bodu
    Dim tp As Point3d, m As Matrix3d
    tp = p: tp.X = p.X + 0.3: tp.Y = p.Y + 0.3
    m = Matrix3dIdentity()
    Set txt = CreateTextElement1(Nothing, cislo, tp, m)
    txt.TextStyle.Height = VYSKA_TEXTU: txt.TextStyle.Width = VYSKA_TEXTU
    ActiveModelReference.AddElement txt
End Sub

' ---------------------------------------------------------------- 2. stáhnout body
Public Sub QTRIG_StahnoutBody()
    If Len(token) = 0 Then QTRIG_Prihlasit
    If vlozene Is Nothing Then Set vlozene = CreateObject("Scripting.Dictionary")
    Dim odp As String, n As Long
    odp = Http("GET", "/sync/points?job=" & ZAKAZKA & "&since=" & CStr(since), "")
    n = ZpracujBody(odp)
    ShowMessage "QTRIG: vloženo " & n & " nových bodů ze zakázky " & ZAKAZKA, "", msdMessageCenterPriorityInfo
End Sub

' projde pole "points":[{...}] a vloží nové body; vrací počet
Private Function ZpracujBody(odp As String) As Long
    Dim p As Long, q As Long, blok As Long, zaznam As String, data As String, id As String, srv As String
    Dim y As Double, x As Double, z As Double, cislo As String, kod As String, n As Long
    p = InStr(1, odp, """points"":[")
    If p = 0 Then Exit Function
    p = p + 10
    Do
        p = InStr(p, odp, "{"): If p = 0 Then Exit Do
        ' záznam končí "}," nebo "}]" na první úrovni; data uvnitř je escapovaný JSON řetězec
        q = InStr(p, odp, "},{")
        If q = 0 Then q = InStr(p, odp, "}]")
        If q = 0 Then Exit Do
        zaznam = Mid$(odp, p, q - p + 1)
        id = JsonHodnota(zaznam, "id")
        srv = JsonHodnota(zaznam, "srv")
        If ToDouble(srv) > since Then since = ToDouble(srv)
        If InStr(zaznam, """deleted"":1") = 0 And Not vlozene.Exists(id) Then
            data = Replace(Replace(JsonHodnota(zaznam, "data"), "\""", """"), "\\", "\")
            cislo = JsonHodnota(data, "name")
            kod = JsonHodnota(data, "kod")
            ' S-JTSK přímo z Kanceláře (prov.y/x); jinak WGS84 bez převodu nevkládáme
            y = ToDouble(JsonHodnota(data, "y")): x = ToDouble(JsonHodnota(data, "x"))
            z = ToDouble(JsonHodnota(data, "vyska"))
            If y > 100000 And x > 100000 Then
                VlozBod cislo, y, x, z, kod
                vlozene.Add id, True
                n = n + 1
            End If
        End If
        p = q + 1
    Loop
    ZpracujBody = n
End Function

' ---------------------------------------------------------------- 3. živý most (časovač)
Public Sub QTRIG_ZivyMost()
    If Len(token) = 0 Then QTRIG_Prihlasit
    bezi = True
    ShowMessage "QTRIG: živý most běží (zakázka " & ZAKAZKA & "), zastavení = QTRIG_Zastavit", "", msdMessageCenterPriorityInfo
    Smycka
End Sub
Public Sub QTRIG_Zastavit()
    bezi = False
    ShowMessage "QTRIG: živý most zastaven", "", msdMessageCenterPriorityInfo
End Sub
Private Sub Smycka()
    Dim t0 As Single
    Do While bezi
        On Error Resume Next
        QTRIG_StahnoutBody
        If Err.Number <> 0 Then ShowMessage "QTRIG: " & Err.Description, "", msdMessageCenterPriorityWarning: Err.Clear
        On Error GoTo 0
        t0 = Timer
        Do While bezi And Timer - t0 < INTERVAL_S
            DoEvents
        Loop
    Loop
End Sub

' ---------------------------------------------------------------- 4. poslat vybrané prvky
Public Sub QTRIG_PoslatVybrane()
    If Len(token) = 0 Then QTRIG_Prihlasit
    Dim ee As ElementEnumerator, e As Element, verts() As Point3d, i As Long, n As Long, telo As String, ts As String
    Dim y As Double, x As Double, cislo As String
    Set ee = ActiveModelReference.GetSelectedElements
    ts = CStr(CLng((Now - #1/1/1970#) * 86400)) & "000"
    telo = "{""job"":""" & ZAKAZKA & """,""changes"":["
    Do While ee.MoveNext
        Set e = ee.Current
        If e.IsLineElement Or e.IsShapeElement Then
            verts = e.AsVertexList.GetVertices
        ElseIf e.IsTextElement Then
            ReDim verts(0): verts(0) = e.AsTextElement.Origin
        Else
            GoTo dalsi
        End If
        For i = LBound(verts) To UBound(verts)
            If ZAPORNE Then
                y = -verts(i).X: x = -verts(i).Y
            Else
                y = verts(i).X: x = verts(i).Y
            End If
            n = n + 1
            cislo = "MS" & Format$(n, "000")
            If e.IsTextElement Then cislo = e.AsTextElement.Text
            If n > 1 Then telo = telo & ","
            telo = telo & "{""id"":""ms_" & cislo & """,""ts"":" & ts & ",""deleted"":0,""data"":""{\""id\"":\""ms_" & cislo & "\"",\""name\"":\""" & cislo & "\"",\""cat\"":\""CUSTOM\"",\""type\"":\""custom\"",\""prov\"":{\""src\"":\""microstation\"",\""y\"":" & Format$(y, "0.000") & ",\""x\"":" & Format$(x, "0.000") & "}}""}"
        Next i
dalsi:
    Loop
    telo = telo & "]}"
    If n = 0 Then ShowMessage "QTRIG: nic není vybráno", "", msdMessageCenterPriorityWarning: Exit Sub
    Http "POST", "/sync/points", telo
    ShowMessage "QTRIG: odesláno " & n & " bodů do zakázky " & ZAKAZKA & " (v Kanceláři: Účet → Stáhnout)", "", msdMessageCenterPriorityInfo
End Sub

Private Function Zhust(s As String) As String
    Do While InStr(s, "  ") > 0: s = Replace(s, "  ", " "): Loop
    Zhust = Trim$(s)
End Function

' ---------------------------------------------------------------- 5. bez cloudu: TXT ze složky
Public Sub QTRIG_NacistSoubor()
    Dim cesta As String, f As Integer, radek As String, c() As String, n As Long
    cesta = InputBox("Cesta k souboru (číslo Y X [Z] [kód], export z Kanceláře):", "QTRIG", "C:\QTRIG\body.txt")
    If Len(cesta) = 0 Then Exit Sub
    f = FreeFile
    Open cesta For Input As #f
    Do While Not EOF(f)
        Line Input #f, radek
        radek = Trim$(radek)
        If Len(radek) > 0 Then
            c = Split(Zhust(Replace(radek, vbTab, " ")), " ")
            If UBound(c) >= 2 Then
                VlozBod c(0), Val(c(1)), Val(c(2)), IIf(UBound(c) >= 3, Val(c(3)), 0), IIf(UBound(c) >= 4, c(4), "")
                n = n + 1
            End If
        End If
    Loop
    Close #f
    ShowMessage "QTRIG: načteno " & n & " bodů ze souboru", "", msdMessageCenterPriorityInfo
End Sub
