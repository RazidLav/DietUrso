import os from "node:os";

// Alguns hosts Windows restritos não expõem a conta do processo ao libuv.
// O tsx consulta apenas o nome para criar seu diretório temporário; este fallback
// mantém a suíte reproduzível sem interferir no código do aplicativo.
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "dieturso-tests",
    homedir: process.cwd(),
    shell: null,
  });
}
