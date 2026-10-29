# JobFlow Browser Extension

Extensão experimental que conecta o navegador ao [JobFlow Local](https://github.com/mendxcyber/jobflow-local). Preenche campos reconhecidos, tenta anexar o currículo fornecido pelo painel e registra o resultado do fluxo.

## Comportamento

Protocolo 3.1.0, compatível com a fila atual do JobFlow Local.

- Lê a fila de candidaturas no serviço local.
- Usa somente dados e respostas previamente configurados.
- Reconhece alguns botões de avanço e envio por texto.
- Interrompe o fluxo ao detectar login, CAPTCHA, campos obrigatórios desconhecidos ou etapa não reconhecida.
- Registra situações que precisam de intervenção no painel.
- Bloqueia páginas que exigem pagamento ou assinatura para candidatar.
- Informa versão e estado das opções para o painel detectar desconexões.
- Usa token de tentativa e exige registro de início de envio antes do clique final.
- Evita repetir o clique de envio e só registra sucesso após detectar confirmação.
- Solicita respostas ao serviço local, que usa banco revisado e IA local opcional.
- Envia evidência e URL para o histórico, com notificações quando permitidas.

**Automação e envio final iniciam desativados na edição pública.** Revise o código e teste em formulário controlado antes de habilitar qualquer opção. Detecção por texto é heurística: não garante compatibilidade com todos os portais nem identificação perfeita do resultado.

## Instalação

Clone o repositório e inicie o JobFlow Local. O endereço padrão é `http://localhost:8090`.

### Chrome e Edge

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative o modo de desenvolvedor e escolha carregar extensão sem compactação.
3. Selecione a pasta `chrome` deste repositório.
4. Abra as opções, confira o endereço do painel e mantenha o envio final desligado durante os testes.

### Firefox

1. Abra `about:debugging#/runtime/this-firefox`.
2. Escolha carregar extensão temporária e selecione `firefox/manifest.json`.
3. Para instalação permanente no Firefox comum, é necessário empacotar e obter assinatura da Mozilla. Este repositório não distribui pacote assinado.

## Permissões e privacidade

A implementação atual solicita acesso amplo a páginas HTTP/HTTPS, além de abas, armazenamento e alarmes. O acesso é necessário ao mecanismo genérico atual, mas é uma limitação de segurança relevante. Não instale em um perfil que contenha sessões sensíveis sem compreender o código; restringir os domínios é uma melhoria planejada.

Também solicita notificações para avisar envios confirmados. Abrir uma vaga
manualmente não inicia uma candidatura: somente abas vinculadas à fila recebem
a tarefa. Abas fechadas ou resultados incertos exigem revisão antes de nova tentativa.

O código não contém serviço de analytics. Dados de candidatura e endereço da página podem ser enviados ao painel configurado. Dados preenchidos e arquivos anexados podem ser transmitidos ao site de emprego. Não há resolução automática de CAPTCHA.

O envio final, se habilitado, pode submeter candidaturas reais. Não habilite respostas automáticas para declarações de veracidade, consentimentos, testes ou informações desconhecidas. O exemplo público de respostas do painel inicia vazio.

## Validação

```bash
node --check chrome/background.js
node --check chrome/content.js
node --check firefox/background.js
node --check firefox/content.js
node tests/check-manifests.cjs
```

Esses checks validam sintaxe, manifests e padrões seguros. Não substituem testes em navegador nem comprovam compatibilidade com portais reais. Não foram enviadas candidaturas como parte da preparação pública.

Desenvolvido por **mendxcyber**, com apoio de IA. MIT. Veja [o anúncio do projeto](docs/ANNOUNCEMENT.md).
