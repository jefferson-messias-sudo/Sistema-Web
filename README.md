# Diário de Progresso do Serviço

Sistema web compartilhado para registrar serviços por dia, técnicos atuantes, situação, percentual do dia e fotos. Inclui visão geral e relatório imprimível em PDF (usar a opção **Salvar como PDF** do navegador).

## Importante: acesso sem login

Este projeto foi solicitado sem autenticação. **Qualquer pessoa que conheça ou descubra o endereço público poderá visualizar, cadastrar e excluir registros e fotos.** Não use para dados confidenciais, nomes/documentos sensíveis ou imagens que não devam ser públicas. Para uso real com equipe, recomendamos adicionar login e permissões.

## Requisitos

- Node.js 20 ou superior
- npm
- Para hospedar: serviço que rode Node.js e ofereça disco persistente (por exemplo, Render com Persistent Disk)

## Executar no computador

1. Extraia o ZIP.
2. Abra um terminal dentro da pasta do projeto.
3. Execute:

   ```bash
   npm install
   npm start
   ```

4. Abra `http://localhost:3000`.

Para permitir que outros dispositivos da mesma rede acessem durante um teste, execute no computador servidor e abra `http://IP-LOCAL-DO-COMPUTADOR:3000` nos outros dispositivos. Pode ser necessário liberar a porta 3000 no firewall. Isso não publica o sistema na internet.

## Publicar no Render com dados persistentes

1. Crie um repositório GitHub e envie **todos os arquivos desta pasta**.
2. Entre em https://render.com e crie um serviço **Blueprint** apontando para o repositório.
3. O Render lerá `render.yaml`, instalará as dependências e configurará o disco persistente em `/data`.
4. Aguarde a implantação e abra o endereço HTTPS fornecido pelo Render.
5. Compartilhe o endereço com a equipe.

O `render.yaml` usa o plano `starter` para suportar disco persistente. Confirme os preços e condições atuais do Render antes de implantar. Um serviço gratuito sem disco persistente pode perder banco de dados e fotos ao reiniciar ou ser reimplantado.

## Como usar

1. Preencha o nome do projeto, a data de início e o progresso geral e clique em **Salvar dados do projeto**.
2. Registre a data do serviço, os técnicos, as atividades, o percentual executado, a situação e até 12 fotos (8 MB por foto).
3. Os dados ficam no servidor e podem ser consultados por outros dispositivos que abram o mesmo endereço.
4. Para gerar PDF, clique em **Relatório PDF** e selecione **Salvar como PDF** na janela de impressão do navegador. Para incluir as fotos, aguarde que elas apareçam no relatório antes de salvar.
5. Para manter uma cópia dos dados, use um backup do disco/servidor. A rota `/api/export` exporta os dados estruturados em JSON, mas não substitui um backup dos arquivos de imagem.

## Armazenamento e cópias de segurança

- Banco SQLite: `DATA_DIR/service-progress.sqlite`
- Fotos: `DATA_DIR/uploads/`
- Localmente, `DATA_DIR` padrão é `./data`.
- No Render, o `render.yaml` configura `DATA_DIR=/data`.
- Faça backups periódicos do banco **e** da pasta `uploads`. Não apague ou mova os arquivos de fotos sem atualizar o banco.

## Limitações conhecidas

- Uma única área de projeto compartilhada por todos.
- Sem login, perfis, trilha de auditoria ou controle de permissões.
- PDF gerado pela função de impressão do navegador; escolha “Salvar como PDF”.
- O progresso geral é informado manualmente.
- O navegador atualiza os registros automaticamente a cada 30 segundos; use o botão de atualizar para buscar imediatamente.

## Antes de uso profissional

Como não há login, proteja o endereço e evite divulgar publicamente. Para um sistema acessível pela internet, o próximo passo recomendado é implementar autenticação, perfis, proteção contra abuso e backups automáticos.
