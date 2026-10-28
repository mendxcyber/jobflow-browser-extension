# Apresentando a extensão do JobFlow

Uma extensão pode ajudar a conectar um painel local ao formulário que está aberto no navegador. Este projeto explora essa integração com versões para Firefox e navegadores Chromium.

O código busca tarefas no JobFlow Local, preenche campos reconhecidos, tenta anexar o PDF correspondente e informa ao painel quando encontra uma etapa que exige intervenção. A identificação de campos e botões usa heurísticas; mudanças nos sites podem interromper o fluxo.

A edição pública inicia com automação e envio final desativados. O código também expõe suas limitações: permissões amplas, necessidade de um serviço local e compatibilidade que depende de cada portal. Nenhum teste de publicação envolveu envio de candidaturas reais.

O objetivo é disponibilizar uma implementação estudável de comunicação entre extensão, página e API local. A documentação explica instalação, permissões, dados transmitidos e oportunidades de melhoria.

Leia o README antes de instalar. Contribuições para restringir permissões e melhorar a detecção de formulários são especialmente úteis.
