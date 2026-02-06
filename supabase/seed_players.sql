-- Script para crear 11 jugadores aleatorios para testing
-- Equipo ID: 358f8843-be2f-44d2-8158-51c68063ab1c

INSERT INTO deportistas (numero_cedula, nombre, nombre_deportivo, fecha_nacimiento, posicion, dorsal, equipo_id) VALUES
-- Portero
('102340567', 'Carlos Rodríguez Mora', 'El Gato', '1995-03-15', 'Portero', 1, '358f8843-be2f-44d2-8158-51c68063ab1c'),

-- Defensas
('203451678', 'Miguel Ángel Hernández', 'El Muro', '1996-07-22', 'Defensa', 2, '358f8843-be2f-44d2-8158-51c68063ab1c'),
('304562789', 'José Luis Vargas', 'Chalo', '1994-11-08', 'Defensa', 3, '358f8843-be2f-44d2-8158-51c68063ab1c'),
('405673890', 'Roberto Castro Solís', 'El Tanque', '1997-02-14', 'Defensa', 4, '358f8843-be2f-44d2-8158-51c68063ab1c'),
('506784901', 'David Ramírez Torres', 'Rami', '1995-09-30', 'Defensa', 5, '358f8843-be2f-44d2-8158-51c68063ab1c'),

-- Mediocampistas
('607895012', 'Fernando Jiménez Rojas', 'El Mago', '1998-05-18', 'Mediocampista', 6, '358f8843-be2f-44d2-8158-51c68063ab1c'),
('708906123', 'Andrés Morales Pérez', 'Andy', '1996-12-25', 'Mediocampista', 8, '358f8843-be2f-44d2-8158-51c68063ab1c'),
('809017234', 'Luis Alberto Salas', 'Lucho', '1997-08-03', 'Mediocampista', 10, '358f8843-be2f-44d2-8158-51c68063ab1c'),

-- Delanteros
('910128345', 'Pablo Méndez Gutiérrez', 'El Pistolero', '1999-01-20', 'Delantero', 9, '358f8843-be2f-44d2-8158-51c68063ab1c'),
('101239456', 'Ricardo Vega Molina', 'Richi', '1998-06-12', 'Delantero', 7, '358f8843-be2f-44d2-8158-51c68063ab1c'),
('112340567', 'Sergio Alfaro Chaves', 'El Flaco', '1997-04-09', 'Delantero', 11, '358f8843-be2f-44d2-8158-51c68063ab1c');

-- Verificar que se insertaron correctamente
SELECT numero_cedula, nombre, posicion, dorsal, edad
FROM deportistas
WHERE equipo_id = '358f8843-be2f-44d2-8158-51c68063ab1c'
ORDER BY dorsal;
