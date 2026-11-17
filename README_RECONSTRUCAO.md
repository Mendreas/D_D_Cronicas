# Crónicas do Véu — Reconstrução D&D 2024 (em desenvolvimento)

## Estado
**Branch de testes, NÃO misturar em main ainda.** O site atual em https://dcronicas.netlify.app/ mantém-se intocado.

## Implementado neste incremento
- Ecrã inicial a distinguir Solo / Multijogador; percurso Solo: **Personagens permanentes → Campanhas → Aventura**; catálogo de três campanhas originais com miniaturas ilustradas extraídas da referência enviada
- Criador inicial de personagens com atributos usando array padrão e cálculo de PV iniciais; personagem e progressão ficam em perfil separado do save de cada campanha
- Solo com save slots por campanha neste navegador, recuperação e imagem automática cacheada por localização em IndexedDB
- Layout Solo: descrição esquerda / cenário direita / ações em baixo, ficha recolhível
- Funções iniciais de regras SRD 2024: modificadores, proficiência, testes d20, iniciativa, CA, danos
- Grupo solo: **sempre 1 jogador humano + 3 companheiros IA** (Kael, Lyra, Neris)
- Multijogador: 2 humanos, 2 companheiros IA, personagens persistentes por conta, lobby e turnos assíncronos (após aplicar migrations)
- Multijogador: ilustrações guardadas em bucket privado Supabase Storage por local (após aplicar migrations)

## Não concluído (não apresentar como D&D SRD integral)
- Regras completas de criação de personagens: distribuição de bónus de origem, talentos, proficiências, idiomas, especializações, feitiços e subclasses
- Motor mecânico completo: ações de combate, vantagem, condições, pontos de magia, descansos, progressão, inventário e economia
- Estado de jogo autoritativo sincronizado, PV, iniciativa e fichas NPC controladas exclusivamente pelo servidor
- Geração assíncrona de imagens acima dos limites de tempo de Netlify; os pedidos podem falhar aos 60 segundos
- Saves solo sincronizados entre dispositivos (hoje ficam no navegador do jogador)
- Interface completa de biblioteca de aventuras com licença verificada e importação de aventuras autorizadas
- Testes end-to-end de dois jogadores e correção de possíveis erros de integração

## Preparar ambiente de testes
1. No Supabase **D_D_Cronicas**, confirmar que foi executado `turnos_assincronos.sql`.
2. Executar `supabase/campanhas_companheiros.sql` como query nova.
3. Executar `supabase/imagens_locais.sql` como query nova.
4. Executar `supabase/personagens_permanentes.sql` como query nova (para reutilizar personagens no multijogador).
5. Confirmar no Netlify os segredos já configurados: OPENAI_API_KEY, GAME_ACCESS_CODE, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY (não os copiar para o GitHub).
6. Abrir o Deploy Preview da PR #2, quando aparecer; iniciar pelo ecrã inicial; criar campanha e personagem solo.
7. Confirmar que uma imagem do mesmo local é reutilizada ao regressar, que o save solo continua após fechar/reabrir o navegador e que o modo multijogador aguarda os dois jogadores.

## Cuidados
O código está em desenvolvimento e passou apenas por validação estática de sintaxe. Não houve execução com a chave OpenAI do utilizador ou no seu projeto Supabase. Fazer primeiro testes no Deploy Preview. Não carregar em Merge ou Publish deploy.

## Atribuição
Este projeto incorpora ideias e mecânicas do SRD 5.2.1 de Wizards of the Coast LLC, em https://www.dndbeyond.com/srd, sob CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/. A implementação e as aventuras de teste são originais e não uma reprodução dos livros comerciais.

## Organização permanente das personagens
Uma personagem é criada antes de escolher a campanha. A ficha base fica num perfil global (localStorage no solo, tabela game_profiles com RLS no multijogador); cada campanha tem uma gravação independente, mas pode reutilizar a personagem e a progressão. A progressão SRD e o registo de experiência ainda precisam do motor de regras completo; a importação automática das alterações entre campanhas foi preparada apenas no cliente.
