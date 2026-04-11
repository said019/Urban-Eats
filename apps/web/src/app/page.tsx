import { redirect } from 'next/navigation';

export default function Home() {
  // Redirigimos la raíz (/ ) temporalmente al demo interactivo de Sarah J!
  // En el futuro, aquí podrás construir la Landing Page o portal para cajeros.
  redirect('/card/sarah');
}
