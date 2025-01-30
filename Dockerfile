# Use uma imagem base do Node.js
FROM node:16

# Crie o diretório de trabalho no container
WORKDIR /app

# Copie o package.json e package-lock.json
COPY package*.json ./

# Instale as dependências
RUN npm install

# Copie todos os arquivos para o container
COPY . .

# Exponha a porta 3000
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["node", "index.js"]
