' Rode este arquivo (2 cliques) UMA VEZ SÓ.
' Ele cria um atalho na Área de Trabalho chamado "Gabriel Oficina Mecânica",
' com a logo como ícone, apontando para o Abrir_Gabriel_Oficina.bat que fica
' nesta mesma pasta. Depois disso, pode ignorar/apagar este arquivo .vbs —
' o atalho na área de trabalho continua funcionando sozinho.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strPastaAtual = fso.GetParentFolderName(WScript.ScriptFullName)
strDesktop = WshShell.SpecialFolders("Desktop")

Set atalho = WshShell.CreateShortcut(strDesktop & "\Gabriel Oficina Mecânica.lnk")
atalho.TargetPath = strPastaAtual & "\Abrir_Gabriel_Oficina.bat"
atalho.WorkingDirectory = strPastaAtual
atalho.IconLocation = strPastaAtual & "\icone_oficina.ico"
atalho.Description = "Abrir o sistema da Gabriel Oficina Mecanica"
atalho.WindowStyle = 7
atalho.Save

MsgBox "Pronto! O atalho 'Gabriel Oficina Mecanica' foi criado na Area de Trabalho." & vbCrLf & vbCrLf & "Pode fechar esta janela.", vbInformation, "Gabriel Oficina Mecanica"
