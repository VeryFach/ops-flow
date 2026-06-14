FROM node:22

WORKDIR /app

# Copy file konfigurasi dependency
COPY package*.json ./

# Copy schema prisma agar postinstall `prisma generate` tidak error
COPY prisma ./prisma/

# Install semua dependency (postinstall akan otomatis menjalankan prisma generate)
RUN npm install

# Copy seluruh kode sumber
COPY . .

# Buka port untuk backend
EXPOSE 3000

# Jalankan server dalam mode development (watch mode)
CMD ["npm", "run", "start:dev"]